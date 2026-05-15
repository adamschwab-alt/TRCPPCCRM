import "./util";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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
import { PipelineStage, Role } from "@prisma/client";
import { sendEmail, inviteEmail, resetEmail } from "./email";
import { validatePassword } from "./policy";
import { audit } from "./audit";
import { generateSecret, provisioningQR, verifyTotp } from "./totp";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MIN = 15;
const RESET_TOKEN_TTL_MIN = 60;
const INVITE_TTL_DAYS = 7;

async function appBaseUrl(req: express.Request): Promise<string> {
  const fromSetting = await prisma.setting.findUnique({ where: { key: "app_base_url" } });
  if (fromSetting?.value) return fromSetting.value;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ===================== AUTH ===================== */
app.post("/api/auth/login", async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    totpCode: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const identifier = parsed.data.username.toLowerCase().trim();
  const password = parsed.data.password;

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });
  if (!user || !user.isActive || user.isArchived) {
    await audit({ event: "login.failed", actorLabel: identifier, req });
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({ error: `Account locked. Try again in ${mins} minute(s).` });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1;
    const data: any = { failedLoginAttempts: attempts };
    if (attempts >= MAX_FAILED_LOGINS) {
      data.lockedUntil = new Date(Date.now() + LOCKOUT_MIN * 60_000);
      data.failedLoginAttempts = 0;
      await prisma.user.update({ where: { id: user.id }, data });
      await audit({ event: "login.locked", userId: user.id, actorLabel: user.username, req });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    await prisma.user.update({ where: { id: user.id }, data });
    await audit({ event: "login.failed", userId: user.id, actorLabel: user.username, req });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Require 2FA if user has it enabled, or if admin-2FA enforcement is on.
  const require2faAdminRow = await prisma.setting.findUnique({ where: { key: "require_2fa_admin" } });
  const adminMustEnroll = require2faAdminRow?.value === "true" && user.role === "ADMIN" && !user.totpEnabled;

  if (user.totpEnabled) {
    if (!parsed.data.totpCode) {
      return res.status(206).json({ needsTotp: true });
    }
    if (!user.totpSecret || !(await verifyTotp(parsed.data.totpCode, user.totpSecret))) {
      await audit({ event: "login.failed", userId: user.id, actorLabel: user.username, req, meta: { reason: "bad_totp" } });
      return res.status(401).json({ error: "Invalid verification code" });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    tokenVersion: user.tokenVersion,
  });
  await audit({ event: "login.success", userId: user.id, actorLabel: user.username, req });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      mustChangePwd: user.mustChangePwd,
      totpEnabled: user.totpEnabled,
      must2faEnroll: adminMustEnroll,
    },
  });
});

/* ----- Forgot / reset password ----- */
app.post("/api/auth/forgot-password", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  // Always return ok, even on miss — avoid leaking which emails exist
  if (!parsed.success) return res.json({ ok: true });
  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findFirst({ where: { email, isArchived: false, isActive: true } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000),
      },
    });
    const base = await appBaseUrl(req);
    const msg = resetEmail({ fullName: user.fullName, appUrl: base, token });
    await sendEmail({ to: email, ...msg });
    await audit({ event: "password.reset.requested", userId: user.id, actorLabel: user.username, req });
  }
  res.json({ ok: true });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    newPassword: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const policyError = await validatePassword(parsed.data.newPassword);
  if (policyError) return res.status(400).json({ error: policyError });
  const rec = await prisma.passwordResetToken.findUnique({ where: { token: parsed.data.token } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
    return res.status(400).json({ error: "Reset link expired or invalid" });
  }
  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: rec.userId },
      data: {
        passwordHash: hash,
        mustChangePwd: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: rec.id },
      data: { usedAt: new Date() },
    }),
  ]);
  await audit({ event: "password.reset.completed", userId: rec.userId, req });
  res.json({ ok: true });
});

/* ----- Self-service signup (only when allow_self_signup setting is true) ----- */
app.post("/api/auth/signup", async (req, res) => {
  const allow = await prisma.setting.findUnique({ where: { key: "allow_self_signup" } });
  if (allow?.value !== "true") {
    return res.status(403).json({ error: "Self-signup is disabled. Ask an admin to invite you." });
  }
  const schema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const policyError = await validatePassword(parsed.data.password);
  if (policyError) return res.status(400).json({ error: policyError });
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: email }] },
  });
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });
  const hash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      username: email,
      fullName: parsed.data.fullName,
      email,
      passwordHash: hash,
      role: "READ_ONLY",
      mustChangePwd: false,
    },
  });
  await audit({ event: "user.created", userId: user.id, actorLabel: user.username, targetType: "user", targetId: user.id, req, meta: { source: "self_signup" } });
  const token = signToken({ id: user.id, username: user.username, role: user.role, fullName: user.fullName, tokenVersion: user.tokenVersion });
  res.json({
    token,
    user: { id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role, mustChangePwd: false },
  });
});

/* ----- Invitations ----- */
app.post(
  "/api/invitations",
  authRequired,
  requireRole("ADMIN"),
  async (req: AuthRequest, res) => {
    const schema = z.object({
      email: z.string().email(),
      fullName: z.string().min(2),
      role: z.enum(["ADMIN", "LEADERSHIP", "ESTIMATOR", "PM", "READ_ONLY"]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username: email }] } });
    if (existing) return res.status(409).json({ error: "A user with that email already exists" });

    const token = crypto.randomBytes(32).toString("hex");
    const inv = await prisma.invitation.create({
      data: {
        token,
        email,
        fullName: parsed.data.fullName,
        role: parsed.data.role as Role,
        invitedById: req.user!.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60_000),
      },
    });
    const base = await appBaseUrl(req);
    const msg = inviteEmail({
      fullName: parsed.data.fullName,
      appUrl: base,
      token,
      invitedBy: req.user!.fullName,
    });
    await sendEmail({ to: email, ...msg });
    await audit({ event: "invitation.sent", userId: req.user!.id, actorLabel: req.user!.username, targetType: "invitation", targetId: inv.id, req, meta: { email, role: parsed.data.role } });
    res.json({ id: inv.id, sentTo: email });
  }
);

app.get("/api/invitations", authRequired, requireRole("ADMIN"), async (_req, res) => {
  const rows = await prisma.invitation.findMany({
    where: { acceptedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { invitedBy: { select: { id: true, fullName: true } } },
  });
  res.json(rows);
});

app.delete("/api/invitations/:id", authRequired, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  await prisma.invitation.delete({ where: { id } });
  await audit({ event: "invitation.revoked", userId: req.user!.id, actorLabel: req.user!.username, targetType: "invitation", targetId: id, req });
  res.json({ ok: true });
});

app.get("/api/invitations/lookup/:token", async (req, res) => {
  const inv = await prisma.invitation.findUnique({ where: { token: req.params.token } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return res.status(404).json({ error: "Invitation invalid or expired" });
  }
  res.json({ email: inv.email, fullName: inv.fullName, role: inv.role });
});

app.post("/api/invitations/accept", async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    password: z.string().min(1),
    username: z.string().min(2).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const policyError = await validatePassword(parsed.data.password);
  if (policyError) return res.status(400).json({ error: policyError });
  const inv = await prisma.invitation.findUnique({ where: { token: parsed.data.token } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return res.status(400).json({ error: "Invitation invalid or expired" });
  }
  const username = (parsed.data.username || inv.email).toLowerCase().trim();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: inv.email }, { username }] },
  });
  if (existing) return res.status(409).json({ error: "Account already exists for this email" });
  const hash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email: inv.email,
      fullName: inv.fullName,
      role: inv.role,
      passwordHash: hash,
      mustChangePwd: false,
    },
  });
  await prisma.invitation.update({
    where: { id: inv.id },
    data: { acceptedAt: new Date() },
  });
  await audit({ event: "invitation.accepted", userId: user.id, actorLabel: user.username, targetType: "invitation", targetId: inv.id, req });
  const tok = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    tokenVersion: user.tokenVersion,
  });
  res.json({
    token: tok,
    user: { id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role, mustChangePwd: false },
  });
});

/* ----- Self-service profile ----- */
app.put("/api/auth/profile", authRequired, async (req: AuthRequest, res) => {
  const schema = z.object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data: any = {};
  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.email !== undefined) {
    data.email = parsed.data.email ? parsed.data.email.toLowerCase().trim() : null;
  }
  try {
    const u = await prisma.user.update({ where: { id: req.user!.id }, data });
    await audit({ event: "profile.updated", userId: u.id, actorLabel: u.username, req, meta: data });
    res.json({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      mustChangePwd: u.mustChangePwd,
      totpEnabled: u.totpEnabled,
    });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "That email is already in use" });
    throw e;
  }
});

/* ===================== 2FA (TOTP) ===================== */
app.post("/api/auth/2fa/setup", authRequired, async (req: AuthRequest, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!u) return res.status(404).json({ error: "Not found" });
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: u.id },
    data: { totpSecret: secret, totpEnabled: false },
  });
  const qr = await provisioningQR({ secret, accountLabel: u.email || u.username });
  res.json({ secret, otpauth: qr.otpauth, qrDataUrl: qr.qrDataUrl });
});

app.post("/api/auth/2fa/verify", authRequired, async (req: AuthRequest, res) => {
  const schema = z.object({ code: z.string().min(6).max(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid code" });
  const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!u || !u.totpSecret) {
    return res.status(400).json({ error: "Start 2FA setup first" });
  }
  if (!(await verifyTotp(parsed.data.code, u.totpSecret))) {
    return res.status(400).json({ error: "Code didn't match. Try again with a fresh code." });
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { totpEnabled: true, tokenVersion: { increment: 1 } },
  });
  await audit({ event: "2fa.enrolled", userId: u.id, actorLabel: u.username, req });
  res.json({ ok: true });
});

app.post("/api/auth/2fa/disable", authRequired, async (req: AuthRequest, res) => {
  const schema = z.object({ password: z.string().min(1), code: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!u) return res.status(404).json({ error: "Not found" });
  const ok = await bcrypt.compare(parsed.data.password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: "Password incorrect" });
  if (u.totpEnabled) {
    if (!parsed.data.code || !u.totpSecret || !(await verifyTotp(parsed.data.code, u.totpSecret))) {
      return res.status(400).json({ error: "Enter a current 6-digit code to disable 2FA." });
    }
  }
  // Block disabling if 2FA is required for admins and this user is an admin
  const require2faAdminRow = await prisma.setting.findUnique({ where: { key: "require_2fa_admin" } });
  if (require2faAdminRow?.value === "true" && u.role === "ADMIN") {
    return res.status(403).json({ error: "2FA is required for Admin accounts. Ask another admin to disable enforcement first." });
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { totpEnabled: false, totpSecret: null, tokenVersion: { increment: 1 } },
  });
  await audit({ event: "2fa.disabled", userId: u.id, actorLabel: u.username, req });
  res.json({ ok: true });
});

app.post("/api/auth/change-password", authRequired, async (req: AuthRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const policyError = await validatePassword(parsed.data.newPassword);
  if (policyError) return res.status(400).json({ error: policyError });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Current password incorrect" });
  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, mustChangePwd: false, tokenVersion: { increment: 1 } },
  });
  await audit({ event: "password.changed", userId: user.id, actorLabel: user.username, req });
  res.json({ ok: true });
});

// Sign out from every device (bumps tokenVersion so all existing JWTs fail)
app.post("/api/auth/logout-all", authRequired, async (req: AuthRequest, res) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { tokenVersion: { increment: 1 } },
  });
  await audit({ event: "logout.all", userId: req.user!.id, actorLabel: req.user!.username, req });
  res.json({ ok: true });
});

app.get("/api/auth/me", authRequired, async (req: AuthRequest, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!u) return res.status(404).json({ error: "Not found" });
  res.json({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    mustChangePwd: u.mustChangePwd,
    totpEnabled: u.totpEnabled,
  });
});

// Public bootstrap config (anything safe for unauthenticated users)
app.get("/api/auth/public-config", async (_req, res) => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["allow_self_signup", "password_min_length", "password_require_mixed"] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json({
    allowSelfSignup: map.allow_self_signup === "true",
    passwordMinLength: parseInt(map.password_min_length || "8", 10),
    passwordRequireMixed: map.password_require_mixed === "true",
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
  async (req: AuthRequest, res) => {
    const body = req.body as Record<string, string>;
    const keys = Object.keys(body);
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    await audit({ event: "settings.updated", userId: req.user!.id, actorLabel: req.user!.username, req, meta: { keys } });
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
      email: true,
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
  async (req: AuthRequest, res) => {
    const schema = z.object({
      username: z.string().min(2),
      fullName: z.string().min(1),
      email: z.string().email().nullable().optional(),
      role: z.enum(["ADMIN", "LEADERSHIP", "ESTIMATOR", "PM", "READ_ONLY"]),
      password: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid input" });
    if (parsed.data.password) {
      const policyError = await validatePassword(parsed.data.password);
      if (policyError) return res.status(400).json({ error: policyError });
    }
    const hash = await bcrypt.hash(parsed.data.password || "Redland2026!", 10);
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username.toLowerCase(),
        fullName: parsed.data.fullName,
        email: parsed.data.email ? parsed.data.email.toLowerCase().trim() : null,
        role: parsed.data.role,
        passwordHash: hash,
        mustChangePwd: true,
      },
    });
    await audit({
      event: "user.created",
      userId: req.user!.id,
      actorLabel: req.user!.username,
      targetType: "user",
      targetId: user.id,
      req,
      meta: { role: parsed.data.role, byAdmin: true },
    });
    res.json({ id: user.id });
  }
);

app.put(
  "/api/users/:id",
  authRequired,
  requireRole("ADMIN"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const { fullName, role, isActive, password } = req.body as any;
    const prior = await prisma.user.findUnique({ where: { id } });
    if (!prior) return res.status(404).json({ error: "Not found" });
    const data: any = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) {
      const policyError = await validatePassword(password);
      if (policyError) return res.status(400).json({ error: policyError });
      data.passwordHash = await bcrypt.hash(password, 10);
      data.mustChangePwd = true;
      data.tokenVersion = { increment: 1 };
    }
    await prisma.user.update({ where: { id }, data });
    if (role !== undefined && role !== prior.role) {
      await audit({
        event: "user.role_changed",
        userId: req.user!.id,
        actorLabel: req.user!.username,
        targetType: "user",
        targetId: id,
        req,
        meta: { from: prior.role, to: role },
      });
    }
    if (password) {
      await audit({
        event: "user.password_reset_by_admin",
        userId: req.user!.id,
        actorLabel: req.user!.username,
        targetType: "user",
        targetId: id,
        req,
      });
    }
    res.json({ ok: true });
  }
);

app.delete(
  "/api/users/:id",
  authRequired,
  requireRole("ADMIN"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    await prisma.user.update({
      where: { id },
      data: { isArchived: true, isActive: false, tokenVersion: { increment: 1 } },
    });
    await audit({
      event: "user.deactivated",
      userId: req.user!.id,
      actorLabel: req.user!.username,
      targetType: "user",
      targetId: id,
      req,
    });
    res.json({ ok: true });
  }
);

/* ===================== AUDIT LOG (read) ===================== */
app.get(
  "/api/audit-log",
  authRequired,
  requireRole("ADMIN", "LEADERSHIP"),
  async (req, res) => {
    const limit = Math.min(parseInt((req.query.limit as string) || "200", 10), 1000);
    const event = req.query.event as string | undefined;
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
    const rows = await prisma.auditLog.findMany({
      where: {
        ...(event ? { event } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, fullName: true, username: true } } },
    });
    res.json(rows);
  }
);

/* ===================== OPPORTUNITIES ===================== */
const opportunityWriteSchema = z.object({
  projectName: z.string().min(1),
  customerName: z.string().min(1),
  customerId: z.number().int().nullable().optional(),
  nextActionDate: z.string().nullable().optional(),
  nextActionNote: z.string().nullable().optional(),
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
  if (input.nextActionDate) data.nextActionDate = new Date(input.nextActionDate);
  else if (input.nextActionDate === null) data.nextActionDate = null;
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
      data.lastActivityAt = new Date();
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
    await prisma.opportunity.update({
      where: { id },
      data: { lastActivityAt: new Date() },
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

    // Three-axis rollup (Vantagepoint-style): bucket the 7 criteria into
    // Client / Project / Competition for at-a-glance decision support.
    const pct = (n: number) => (n / 5) * 100;
    const clientScore =
      (pct(s.customerScore) * wc + pct(s.geoScore) * wg + pct(s.strategicScore) * ws) /
      (wc + wg + ws);
    const projectScore =
      (pct(s.marginScore) * wm + pct(s.scopeRiskScore) * wsr + pct(s.bondRiskScore) * wb) /
      (wm + wsr + wb);
    const competitionScore = pct(s.resourceScore);

    // Decision band: combines composite score with $ thresholds → who must approve.
    const opportunity = await prisma.opportunity.findUnique({ where: { id } });
    const valueDollars = opportunity ? Number(opportunity.estimatedValueCents) / 100 : 0;
    const davidLimit = parseFloat((settings.find((r) => r.key === "go_no_go_threshold_david")?.value) || "5000000");
    const chadLimit = parseFloat((settings.find((r) => r.key === "go_no_go_threshold_chad")?.value) || "15000000");
    let band: string;
    if (composite < 50) band = "NO_GO_RECOMMENDED";
    else if (valueDollars > chadLimit) band = "TIER_2_APPROVAL"; // Chad + Pinky
    else if (valueDollars > davidLimit) band = "TIER_1_APPROVAL"; // David recommends, Chad approves
    else if (composite >= 70) band = "AUTO_GO";
    else band = "MANAGEMENT_REVIEW";

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
      data: {
        goNoGoScore: composite,
        goNoGoClientScore: clientScore,
        goNoGoProjectScore: projectScore,
        goNoGoCompetitionScore: competitionScore,
        goNoGoDecisionBand: band,
        lastActivityAt: new Date(),
      },
    });
    res.json({ ...rec, clientScore, projectScore, competitionScore, band });
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
      customerId: true,
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

  // Weighted-fee hit rate by customer / estimator / region / type
  // (Vantagepoint pattern) — bid$ won / bid$ pursued among decided bids.
  // Far more meaningful than count-based win rate for an 85%-repeat shop.
  function weightedHitRateBy(
    field: "customerName" | "estimatorId" | "region" | "projectType" | "customerType"
  ) {
    const groups: Record<string, { wonCents: bigint; pursuedCents: bigint; wonCount: number; pursuedCount: number }> = {};
    for (const o of ops) {
      if (!["WON", "LOST"].includes(o.stage)) continue;
      const raw = o[field];
      const k = raw === null || raw === undefined ? "Unknown" : String(raw);
      const g = groups[k] || { wonCents: 0n, pursuedCents: 0n, wonCount: 0, pursuedCount: 0 };
      g.pursuedCents += o.estimatedValueCents;
      g.pursuedCount++;
      if (o.stage === "WON") {
        g.wonCents += o.actualValueCents ?? o.estimatedValueCents;
        g.wonCount++;
      }
      groups[k] = g;
    }
    return groups;
  }
  const hitRateByCustomer = weightedHitRateBy("customerName");
  const hitRateByEstimator = weightedHitRateBy("estimatorId");
  const hitRateByRegionWeighted = weightedHitRateBy("region");
  const hitRateByTypeWeighted = weightedHitRateBy("projectType");
  const hitRateByCustomerType = weightedHitRateBy("customerType");

  // Customer-tier hit rate (joins Opportunity → Customer.tier when available)
  // Implemented by joining customerId at query time:
  const customersWithTier = await prisma.customer.findMany({
    where: { isArchived: false },
    select: { id: true, tier: true, companyName: true },
  });
  const tierByCustomer: Record<number, string> = {};
  const tierByName: Record<string, string> = {};
  for (const c of customersWithTier) {
    tierByCustomer[c.id] = c.tier;
    tierByName[c.companyName] = c.tier;
  }
  const tierGroups: Record<string, { wonCents: bigint; pursuedCents: bigint; wonCount: number; pursuedCount: number }> = {};
  for (const o of ops) {
    if (!["WON", "LOST"].includes(o.stage)) continue;
    const tier = (o as any).customerId
      ? tierByCustomer[(o as any).customerId] || "UNTIERED"
      : tierByName[o.customerName] || "UNTIERED";
    const g = tierGroups[tier] || { wonCents: 0n, pursuedCents: 0n, wonCount: 0, pursuedCount: 0 };
    g.pursuedCents += o.estimatedValueCents;
    g.pursuedCount++;
    if (o.stage === "WON") {
      g.wonCents += o.actualValueCents ?? o.estimatedValueCents;
      g.wonCount++;
    }
    tierGroups[tier] = g;
  }

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
    hitRateByCustomer,
    hitRateByEstimator,
    hitRateByRegionWeighted,
    hitRateByTypeWeighted,
    hitRateByCustomerType,
    hitRateByTier: tierGroups,
    estimatorStats,
    topCustomers,
  });
});

/* ===================== TODAY WORKSPACE ===================== */
// Returns: tasks due / overdue, stale (rotted) deals, suggested actions,
// recent wins/losses. Driven by hardcoded rules — no ML, no AI.
app.get("/api/dashboard/today", authRequired, async (req: AuthRequest, res) => {
  const now = new Date();
  const userId = req.user!.id;
  const isPersonal = req.query.scope === "mine";

  // Rotting thresholds (days) by stage, from settings
  const settings = await prisma.setting.findMany({ where: { key: { startsWith: "rot_" } } });
  const rotMap: Record<string, number> = {};
  for (const s of settings) rotMap[s.key.replace("rot_", "")] = parseFloat(s.value);

  const ops = await prisma.opportunity.findMany({
    where: {
      isArchived: false,
      stage: { notIn: ["WON", "LOST", "NO_BID", "WITHDRAWN"] },
      ...(isPersonal ? { estimatorId: userId } : {}),
    },
    include: {
      estimator: { select: { id: true, fullName: true } },
      customer: { select: { id: true, tier: true } },
    },
  });

  // Build views
  const tasksDue: any[] = [];
  const tasksOverdue: any[] = [];
  const stale: any[] = [];
  const needsAction: any[] = [];
  const goNoGoPending: any[] = [];
  const overdueBids: any[] = [];

  for (const o of ops) {
    const rot = rotMap[o.stage] ?? 0;
    const daysIdle = (now.getTime() - new Date(o.lastActivityAt).getTime()) / 86_400_000;
    const isStale = rot > 0 && daysIdle >= rot;

    if (o.nextActionDate) {
      const due = new Date(o.nextActionDate);
      const isToday = due.toDateString() === now.toDateString();
      if (due < now && !isToday) tasksOverdue.push({ ...o, daysIdle });
      else if (isToday || due.getTime() - now.getTime() < 86_400_000) tasksDue.push({ ...o, daysIdle });
    } else {
      needsAction.push({ ...o, daysIdle });
    }

    if (isStale) stale.push({ ...o, daysIdle });

    // Suggested-action rules
    if (o.stage === "REVIEWING_ITB" && daysIdle >= 2) {
      goNoGoPending.push({ ...o, daysIdle });
    }
    if (
      o.bidDueDate &&
      new Date(o.bidDueDate) < now &&
      ["ESTIMATING", "BID_SUBMITTED", "AWAITING_DECISION", "REVIEWING_ITB"].includes(o.stage)
    ) {
      overdueBids.push({ ...o, daysIdle });
    }
  }

  // Suggested actions (top N): generate human-readable nudges
  const suggestions: { kind: string; opportunityId: number; projectName: string; message: string; severity: "high" | "medium" | "low" }[] = [];
  for (const o of overdueBids.slice(0, 6)) {
    suggestions.push({
      kind: "overdue_bid",
      opportunityId: o.id,
      projectName: o.projectName,
      message: `Bid due date passed — still in ${o.stage.replace(/_/g, " ")}`,
      severity: "high",
    });
  }
  for (const o of goNoGoPending.slice(0, 6)) {
    suggestions.push({
      kind: "go_no_go_pending",
      opportunityId: o.id,
      projectName: o.projectName,
      message: `Reviewing ITB for ${Math.floor(o.daysIdle)} days — run Go/No-Go`,
      severity: "medium",
    });
  }
  for (const o of stale.slice(0, 6)) {
    if (suggestions.find((s) => s.opportunityId === o.id)) continue;
    suggestions.push({
      kind: "stale",
      opportunityId: o.id,
      projectName: o.projectName,
      message: `No activity for ${Math.floor(o.daysIdle)} days in ${o.stage.replace(/_/g, " ")}`,
      severity: o.daysIdle > (rotMap[o.stage] ?? 0) * 2 ? "high" : "medium",
    });
  }
  for (const o of needsAction.slice(0, 6)) {
    if (suggestions.find((s) => s.opportunityId === o.id)) continue;
    suggestions.push({
      kind: "no_next_action",
      opportunityId: o.id,
      projectName: o.projectName,
      message: `No next action scheduled`,
      severity: "low",
    });
  }

  // Recent wins/losses (last 14 days)
  const since = new Date(Date.now() - 14 * 86_400_000);
  const recentDecisions = await prisma.opportunity.findMany({
    where: {
      isArchived: false,
      stage: { in: ["WON", "LOST"] },
      decidedAt: { gte: since },
    },
    orderBy: { decidedAt: "desc" },
    take: 10,
    select: {
      id: true,
      projectName: true,
      customerName: true,
      stage: true,
      decidedAt: true,
      estimatedValueCents: true,
      actualValueCents: true,
      lossReason: true,
    },
  });

  res.json({
    tasksDueToday: tasksDue,
    tasksOverdue,
    needsActionCount: needsAction.length,
    staleCount: stale.length,
    overdueBidCount: overdueBids.length,
    suggestions: suggestions.slice(0, 12),
    recentDecisions,
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
