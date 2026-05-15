import "./util";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { prisma } from "./db";
import {
  authRequired,
  AuthRequest,
  readOnlyBlocked,
  requireRole,
  signToken,
} from "./auth";
import { toCents, nextProjectNumber } from "./util";
import { PipelineStage } from "@prisma/client";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ===================== AUTH ===================== */
app.post("/api/auth/login", async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });
  if (!user || !user.isActive || user.isArchived) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
  });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      mustChangePwd: user.mustChangePwd,
    },
  });
});

app.post("/api/auth/change-password", authRequired, async (req: AuthRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Current password incorrect" });
  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, mustChangePwd: false },
  });
  res.json({ ok: true });
});

app.get("/api/auth/me", authRequired, async (req: AuthRequest, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!u) return res.status(404).json({ error: "Not found" });
  res.json({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    mustChangePwd: u.mustChangePwd,
  });
});

/* ===================== SETTINGS ===================== */
app.get("/api/settings", authRequired, async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

app.put(
  "/api/settings",
  authRequired,
  requireRole("ADMIN", "LEADERSHIP"),
  async (req, res) => {
    const body = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    res.json({ ok: true });
  }
);

/* ===================== DROPDOWNS ===================== */
app.get("/api/dropdowns", authRequired, async (_req, res) => {
  const rows = await prisma.dropdownOption.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  const grouped: Record<string, string[]> = {};
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r.value);
  }
  res.json(grouped);
});

app.post(
  "/api/dropdowns",
  authRequired,
  requireRole("ADMIN", "LEADERSHIP"),
  async (req, res) => {
    const { category, value } = req.body as { category: string; value: string };
    if (!category || !value)
      return res.status(400).json({ error: "category and value required" });
    const last = await prisma.dropdownOption.findFirst({
      where: { category },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;
    const created = await prisma.dropdownOption.upsert({
      where: { category_value: { category, value } },
      update: { isActive: true },
      create: { category, value, sortOrder },
    });
    res.json(created);
  }
);

app.delete(
  "/api/dropdowns/:id",
  authRequired,
  requireRole("ADMIN", "LEADERSHIP"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await prisma.dropdownOption.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ ok: true });
  }
);

/* ===================== USERS ===================== */
app.get("/api/users", authRequired, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isArchived: false },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });
  res.json(users);
});

app.post(
  "/api/users",
  authRequired,
  requireRole("ADMIN"),
  async (req, res) => {
    const schema = z.object({
      username: z.string().min(2),
      fullName: z.string().min(1),
      role: z.enum(["ADMIN", "LEADERSHIP", "ESTIMATOR", "PM", "READ_ONLY"]),
      password: z.string().min(8).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid input" });
    const hash = await bcrypt.hash(parsed.data.password || "Redland2026!", 10);
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username.toLowerCase(),
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        passwordHash: hash,
        mustChangePwd: true,
      },
    });
    res.json({ id: user.id });
  }
);

app.put(
  "/api/users/:id",
  authRequired,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { fullName, role, isActive, password } = req.body as any;
    const data: any = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
      data.mustChangePwd = true;
    }
    await prisma.user.update({ where: { id }, data });
    res.json({ ok: true });
  }
);

app.delete(
  "/api/users/:id",
  authRequired,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await prisma.user.update({
      where: { id },
      data: { isArchived: true, isActive: false },
    });
    res.json({ ok: true });
  }
);

/* ===================== OPPORTUNITIES ===================== */
const opportunityWriteSchema = z.object({
  projectName: z.string().min(1),
  customerName: z.string().min(1),
  customerId: z.number().int().nullable().optional(),
  customerType: z
    .enum(["GC", "DEVELOPER", "GOVERNMENT", "OWNER_DIRECT"])
    .optional(),
  projectType: z.string().optional().default(""),
  region: z.string().optional().default(""),
  scopeOfWork: z.array(z.string()).optional().default([]),
  estimatedValue: z.union([z.number(), z.string()]).optional(),
  bidMarginPct: z.number().optional(),
  expectedMarginPct: z.number().nullable().optional(),
  bidDueDate: z.string().nullable().optional(),
  estimatedStartDate: z.string().nullable().optional(),
  estimatedDurationMonths: z.number().int().nullable().optional(),
  stage: z
    .enum([
      "LEAD",
      "REVIEWING_ITB",
      "GO_NO_GO",
      "ESTIMATING",
      "BID_SUBMITTED",
      "AWAITING_DECISION",
      "WON",
      "LOST",
      "NO_BID",
      "WITHDRAWN",
    ])
    .optional(),
  bondingRequired: z.boolean().optional(),
  bondAmount: z.union([z.number(), z.string()]).nullable().optional(),
  estimatorId: z.number().int().nullable().optional(),
  pmId: z.number().int().nullable().optional(),
  source: z.string().nullable().optional(),
  competitive: z.boolean().optional(),
  lastLook: z.boolean().optional(),
  actualValue: z.union([z.number(), z.string()]).nullable().optional(),
  winningBid: z.union([z.number(), z.string()]).nullable().optional(),
  winningBidder: z.string().nullable().optional(),
  lossReason: z.string().nullable().optional(),
  noBidReason: z.string().nullable().optional(),
  backlogStatus: z
    .enum(["ACTIVE", "COMPLETE", "ON_HOLD", "CANCELLED"])
    .optional(),
});

function mapInputToData(input: z.infer<typeof opportunityWriteSchema>) {
  const data: any = { ...input };
  if (input.estimatedValue !== undefined) {
    data.estimatedValueCents = toCents(input.estimatedValue as any) ?? 0n;
    delete data.estimatedValue;
  }
  if (input.actualValue !== undefined) {
    data.actualValueCents = toCents(input.actualValue as any);
    delete data.actualValue;
  }
  if (input.winningBid !== undefined) {
    data.winningBidCents = toCents(input.winningBid as any);
    delete data.winningBid;
  }
  if (input.bondAmount !== undefined) {
    data.bondAmountCents = toCents(input.bondAmount as any);
    delete data.bondAmount;
  }
  if (input.bidDueDate) data.bidDueDate = new Date(input.bidDueDate);
  else if (input.bidDueDate === null) data.bidDueDate = null;
  if (input.estimatedStartDate)
    data.estimatedStartDate = new Date(input.estimatedStartDate);
  else if (input.estimatedStartDate === null) data.estimatedStartDate = null;
  return data;
}

app.get("/api/opportunities", authRequired, async (req, res) => {
  const {
    stage,
    estimatorId,
    region,
    projectType,
    customerType,
    source,
    bondingRequired,
    search,
    from,
    to,
  } = req.query as Record<string, string>;
  const where: any = { isArchived: false };
  if (stage) where.stage = stage;
  if (estimatorId) where.estimatorId = parseInt(estimatorId, 10);
  if (region) where.region = region;
  if (projectType) where.projectType = projectType;
  if (customerType) where.customerType = customerType;
  if (source) where.source = source;
  if (bondingRequired) where.bondingRequired = bondingRequired === "true";
  if (search) {
    where.OR = [
      { projectName: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { projectNumber: { contains: search, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.bidDueDate = {};
    if (from) where.bidDueDate.gte = new Date(from);
    if (to) where.bidDueDate.lte = new Date(to);
  }
  const rows = await prisma.opportunity.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      estimator: { select: { id: true, fullName: true } },
      pm: { select: { id: true, fullName: true } },
    },
  });
  res.json(rows);
});

app.get("/api/opportunities/:id", authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const o = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      estimator: { select: { id: true, fullName: true } },
      pm: { select: { id: true, fullName: true } },
      notes: {
        include: { author: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      },
      stageHistory: {
        orderBy: { changedAt: "desc" },
      },
      goNoGoDecisions: {
        orderBy: { createdAt: "desc" },
        include: { approver: { select: { id: true, fullName: true } } },
      },
    },
  });
  if (!o) return res.status(404).json({ error: "Not found" });
  res.json(o);
});

app.post(
  "/api/opportunities",
  authRequired,
  readOnlyBlocked,
  async (req: AuthRequest, res) => {
    const parsed = opportunityWriteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    const data = mapInputToData(parsed.data);
    const projectNumber = await nextProjectNumber(prisma);
    const created = await prisma.opportunity.create({
      data: {
        ...data,
        projectNumber,
        createdById: req.user!.id,
        updatedById: req.user!.id,
        stage: data.stage || "LEAD",
        stageChangedAt: new Date(),
      },
    });
    await prisma.stageHistory.create({
      data: {
        opportunityId: created.id,
        toStage: created.stage,
        changedById: req.user!.id,
      },
    });
    res.json(created);
  }
);

app.put(
  "/api/opportunities/:id",
  authRequired,
  readOnlyBlocked,
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const parsed = opportunityWriteSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    const data = mapInputToData(parsed.data as any);
    const existing = await prisma.opportunity.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const stageChanged =
      data.stage && data.stage !== existing.stage
        ? (data.stage as PipelineStage)
        : null;
    if (stageChanged) {
      data.stageChangedAt = new Date();
      if (stageChanged === "BID_SUBMITTED") data.bidSubmittedAt = new Date();
      if (
        stageChanged === "WON" ||
        stageChanged === "LOST" ||
        stageChanged === "NO_BID" ||
        stageChanged === "WITHDRAWN"
      ) {
        data.decidedAt = new Date();
      }
    }
    const updated = await prisma.opportunity.update({
      where: { id },
      data: { ...data, updatedById: req.user!.id },
    });
    if (stageChanged) {
      await prisma.stageHistory.create({
        data: {
          opportunityId: id,
          fromStage: existing.stage,
          toStage: stageChanged,
          changedById: req.user!.id,
        },
      });
    }
    res.json(updated);
  }
);

app.delete(
  "/api/opportunities/:id",
  authRequired,
  requireRole("ADMIN", "LEADERSHIP"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await prisma.opportunity.update({
      where: { id },
      data: { isArchived: true },
    });
    res.json({ ok: true });
  }
);

/* --- Notes --- */
app.post(
  "/api/opportunities/:id/notes",
  authRequired,
  readOnlyBlocked,
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const body = (req.body?.body || "").toString().trim();
    if (!body) return res.status(400).json({ error: "Body required" });
    const note = await prisma.opportunityNote.create({
      data: { opportunityId: id, authorId: req.user!.id, body },
      include: { author: { select: { id: true, fullName: true } } },
    });
    res.json(note);
  }
);

/* ===================== GO/NO-GO ===================== */
app.post(
  "/api/opportunities/:id/go-no-go",
  authRequired,
  readOnlyBlocked,
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const schema = z.object({
      marginScore: z.number().int().min(1).max(5),
      customerScore: z.number().int().min(1).max(5),
      geoScore: z.number().int().min(1).max(5),
      scopeRiskScore: z.number().int().min(1).max(5),
      resourceScore: z.number().int().min(1).max(5),
      bondRiskScore: z.number().int().min(1).max(5),
      strategicScore: z.number().int().min(1).max(5),
      decision: z.enum(["GO", "NO_GO", "DEFER"]),
      conditions: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid input" });
    const s = parsed.data;
    const settings = await prisma.setting.findMany();
    const w: Record<string, number> = {};
    for (const r of settings) w[r.key] = parseFloat(r.value);
    const wm = w.weight_margin ?? 25;
    const wc = w.weight_customer ?? 20;
    const wg = w.weight_geo ?? 15;
    const wsr = w.weight_scope_risk ?? 15;
    const wr = w.weight_resource ?? 10;
    const wb = w.weight_bond_risk ?? 5;
    const ws = w.weight_strategic ?? 10;
    // each score 1-5 → percentage of weight (score/5)*weight, total max = sum(weights)
    const composite =
      (s.marginScore / 5) * wm +
      (s.customerScore / 5) * wc +
      (s.geoScore / 5) * wg +
      (s.scopeRiskScore / 5) * wsr +
      (s.resourceScore / 5) * wr +
      (s.bondRiskScore / 5) * wb +
      (s.strategicScore / 5) * ws;

    const rec = await prisma.goNoGoDecisionRecord.create({
      data: {
        opportunityId: id,
        marginScore: s.marginScore,
        customerScore: s.customerScore,
        geoScore: s.geoScore,
        scopeRiskScore: s.scopeRiskScore,
        resourceScore: s.resourceScore,
        bondRiskScore: s.bondRiskScore,
        strategicScore: s.strategicScore,
        compositeScore: composite,
        decision: s.decision,
        approverId: req.user!.id,
        conditions: s.conditions || null,
      },
    });
    await prisma.opportunity.update({
      where: { id },
      data: { goNoGoScore: composite },
    });
    res.json(rec);
  }
);

/* ===================== CUSTOMERS ===================== */
app.get("/api/customers", authRequired, async (_req, res) => {
  const rows = await prisma.customer.findMany({
    where: { isArchived: false },
    orderBy: { companyName: "asc" },
    include: { owner: { select: { id: true, fullName: true } } },
  });
  // augment with computed stats
  const ops = await prisma.opportunity.findMany({
    where: { isArchived: false },
    select: {
      customerId: true,
      stage: true,
      estimatedValueCents: true,
      actualValueCents: true,
      bidDueDate: true,
      decidedAt: true,
    },
  });
  const stats = new Map<number, any>();
  for (const o of ops) {
    if (!o.customerId) continue;
    const s = stats.get(o.customerId) || {
      total: 0,
      won: 0,
      revenueCents: 0n,
      lastBid: null as Date | null,
      lastProject: null as Date | null,
    };
    s.total++;
    if (o.stage === "WON") {
      s.won++;
      s.revenueCents += o.actualValueCents ?? o.estimatedValueCents;
      if (o.decidedAt && (!s.lastProject || o.decidedAt > s.lastProject))
        s.lastProject = o.decidedAt;
    }
    if (o.bidDueDate && (!s.lastBid || o.bidDueDate > s.lastBid))
      s.lastBid = o.bidDueDate;
    stats.set(o.customerId, s);
  }
  const enriched = rows.map((r) => {
    const s = stats.get(r.id) || {
      total: 0,
      won: 0,
      revenueCents: 0n,
      lastBid: null,
      lastProject: null,
    };
    return {
      ...r,
      totalProjects: s.total,
      wonProjects: s.won,
      winRate: s.total ? s.won / s.total : 0,
      totalRevenueCents: s.revenueCents,
      lastBidDate: s.lastBid,
      lastProjectDate: s.lastProject,
    };
  });
  res.json(enriched);
});

app.post(
  "/api/customers",
  authRequired,
  readOnlyBlocked,
  async (req: AuthRequest, res) => {
    const schema = z.object({
      companyName: z.string().min(1),
      primaryContact: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      customerType: z
        .enum(["GC", "DEVELOPER", "GOVERNMENT", "OWNER_DIRECT"])
        .optional(),
      tier: z.enum(["PLATINUM", "GOLD", "SILVER", "NEW"]).optional(),
      lastLook: z.boolean().optional(),
      ownerId: z.number().int().nullable().optional(),
      notes: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid input" });
    const c = await prisma.customer.create({
      data: { ...parsed.data, createdById: req.user!.id, updatedById: req.user!.id },
    });
    res.json(c);
  }
);

app.put(
  "/api/customers/:id",
  authRequired,
  readOnlyBlocked,
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const data = req.body as any;
    const c = await prisma.customer.update({
      where: { id },
      data: { ...data, updatedById: req.user!.id },
    });
    res.json(c);
  }
);

app.delete(
  "/api/customers/:id",
  authRequired,
  requireRole("ADMIN", "LEADERSHIP"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await prisma.customer.update({ where: { id }, data: { isArchived: true } });
    res.json({ ok: true });
  }
);

/* ===================== ANALYTICS ===================== */
app.get("/api/analytics/summary", authRequired, async (_req, res) => {
  const ops = await prisma.opportunity.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      stage: true,
      estimatedValueCents: true,
      actualValueCents: true,
      estimatorId: true,
      region: true,
      projectType: true,
      customerType: true,
      customerName: true,
      bidDueDate: true,
      stageChangedAt: true,
      bidSubmittedAt: true,
      decidedAt: true,
      lossReason: true,
      noBidReason: true,
      source: true,
    },
  });
  const byStage: Record<string, { count: number; valueCents: bigint }> = {};
  for (const o of ops) {
    const s = byStage[o.stage] || { count: 0, valueCents: 0n };
    s.count++;
    s.valueCents += o.estimatedValueCents;
    byStage[o.stage] = s;
  }

  // win rate (won / (won + lost)) all-time
  const won = ops.filter((o) => o.stage === "WON");
  const lost = ops.filter((o) => o.stage === "LOST");
  const winRate = won.length + lost.length === 0
    ? 0
    : won.length / (won.length + lost.length);

  // monthly win rate trend (last 12 months by decidedAt)
  const now = new Date();
  const buckets: { month: string; bids: number; wins: number; losses: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      bids: 0,
      wins: 0,
      losses: 0,
    });
  }
  function bucketFor(d: Date | null | undefined) {
    if (!d) return null;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return buckets.find((b) => b.month === key) || null;
  }
  for (const o of ops) {
    const b = bucketFor(o.bidSubmittedAt);
    if (b) b.bids++;
    if (o.stage === "WON") {
      const wb = bucketFor(o.decidedAt);
      if (wb) wb.wins++;
    }
    if (o.stage === "LOST") {
      const lb = bucketFor(o.decidedAt);
      if (lb) lb.losses++;
    }
  }

  // backlog (won, not complete)
  const backlogCents = ops
    .filter((o) => o.stage === "WON")
    .reduce((a, o) => a + (o.actualValueCents ?? o.estimatedValueCents), 0n);

  // loss reasons
  const lossReasons: Record<string, number> = {};
  for (const o of lost) {
    const k = o.lossReason || "Unknown";
    lossReasons[k] = (lossReasons[k] || 0) + 1;
  }
  const noBidReasons: Record<string, number> = {};
  for (const o of ops.filter((x) => x.stage === "NO_BID")) {
    const k = o.noBidReason || "Unknown";
    noBidReasons[k] = (noBidReasons[k] || 0) + 1;
  }

  // overdue (bid due passed but still active estimating/bid_submitted/etc.)
  const overdue = ops.filter(
    (o) =>
      o.bidDueDate &&
      o.bidDueDate < now &&
      ["ESTIMATING", "BID_SUBMITTED", "AWAITING_DECISION", "REVIEWING_ITB"].includes(
        o.stage
      )
  );

  // win rate by region/type
  function rateBy(field: "region" | "projectType" | "customerType") {
    const groups: Record<string, { won: number; lost: number; total: number; valueCents: bigint }> = {};
    for (const o of ops) {
      const k = (o[field] as string) || "Unknown";
      const g = groups[k] || { won: 0, lost: 0, total: 0, valueCents: 0n };
      g.total++;
      g.valueCents += o.estimatedValueCents;
      if (o.stage === "WON") g.won++;
      if (o.stage === "LOST") g.lost++;
      groups[k] = g;
    }
    return groups;
  }

  // estimator stats
  const estimatorStats: Record<number, any> = {};
  for (const o of ops) {
    if (!o.estimatorId) continue;
    const s = estimatorStats[o.estimatorId] || {
      active: 0,
      won: 0,
      lost: 0,
      total: 0,
      activeValueCents: 0n,
      totalDays: 0,
      submittedCount: 0,
    };
    s.total++;
    if (
      ["LEAD", "REVIEWING_ITB", "GO_NO_GO", "ESTIMATING", "BID_SUBMITTED", "AWAITING_DECISION"].includes(
        o.stage
      )
    ) {
      s.active++;
      s.activeValueCents += o.estimatedValueCents;
    }
    if (o.stage === "WON") s.won++;
    if (o.stage === "LOST") s.lost++;
    if (o.bidSubmittedAt && o.stageChangedAt) {
      // crude turnaround: stageChangedAt - earliest creation isn't tracked, skip
    }
    estimatorStats[o.estimatorId] = s;
  }

  // customer concentration (won revenue)
  const custMap: Record<string, bigint> = {};
  for (const o of won) {
    const key = o.customerName || "Unknown";
    custMap[key] = (custMap[key] || 0n) + (o.actualValueCents ?? o.estimatedValueCents);
  }
  const topCustomers = Object.entries(custMap)
    .map(([k, v]) => ({ name: k, revenueCents: v }))
    .sort((a, b) => (b.revenueCents > a.revenueCents ? 1 : -1))
    .slice(0, 10);

  res.json({
    counts: {
      total: ops.length,
      won: won.length,
      lost: lost.length,
      winRate,
    },
    byStage,
    monthly: buckets,
    backlogCents,
    lossReasons,
    noBidReasons,
    overdue: overdue.map((o) => ({ id: o.id })),
    overdueCount: overdue.length,
    rateByRegion: rateBy("region"),
    rateByProjectType: rateBy("projectType"),
    rateByCustomerType: rateBy("customerType"),
    estimatorStats,
    topCustomers,
  });
});

/* ===================== STATIC SPA (production) ===================== */
const STATIC_DIR = path.resolve(__dirname, "../public");
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
  console.log(`Serving SPA from ${STATIC_DIR}`);
}

/* ===================== START ===================== */
const PORT = parseInt(process.env.PORT || "4000", 10);
app.listen(PORT, () => {
  console.log(`Redland CRM API listening on :${PORT}`);
});
