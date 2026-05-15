// HCSS HeavyBid + Sage 300 CRE CSV/Excel import + preview.
// These services don't have a public API; the realistic v1 is users export
// CSVs from HeavyBid/Sage and we ingest them. Auto-match by job number /
// project name; surface unmatched rows for manual review before commit.

import { prisma } from "./db";
import { parseCSV, parseMoney, parsePct, parseDate } from "./csv";

type Row = Record<string, string>;

const pick = (r: Row, ...keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== "") return v;
  }
  return "";
};

/* ----------------- HEAVYBID ----------------- */
// Expected CSV columns (loose — many HeavyBid Bid Summary exports vary):
//   Job # / Job Number / Bid #
//   Project Name / Job Name
//   Owner / Customer
//   Bid Total / Estimated Value / Total Bid
//   Bid Date / Bid Due
//   Estimator
//   Status (Active / Won / Lost / Pending / etc)
//   Region / Location / State

export async function previewHeavyBidImport(csv: string) {
  const parsed = parseCSV(csv);
  const matched: any[] = [];
  const newRows: any[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const jobNumber = pick(r, "job_number", "job", "bid_number", "bid");
    const projectName = pick(r, "project_name", "job_name", "project", "description");
    const customerName = pick(r, "owner", "customer", "client");
    const bidTotal = parseMoney(pick(r, "bid_total", "total_bid", "estimated_value", "bid_amount", "total"));
    if (!projectName) {
      errors.push({ row: i + 2, reason: "Missing project name" });
      continue;
    }
    // Match priority: heavyBidJobNumber → projectName + customerName → projectName
    let existing = null as any;
    if (jobNumber) {
      existing = await prisma.opportunity.findFirst({ where: { heavyBidJobNumber: jobNumber } });
    }
    if (!existing && projectName && customerName) {
      existing = await prisma.opportunity.findFirst({
        where: { projectName: { equals: projectName, mode: "insensitive" }, customerName: { equals: customerName, mode: "insensitive" } },
      });
    }
    if (!existing && projectName) {
      existing = await prisma.opportunity.findFirst({
        where: { projectName: { equals: projectName, mode: "insensitive" } },
      });
    }
    const summary = {
      rowIndex: i + 2,
      jobNumber,
      projectName,
      customerName,
      bidTotalCents: bidTotal ? bidTotal.toString() : null,
      bidDueDate: parseDate(pick(r, "bid_date", "bid_due", "due_date"))?.toISOString() ?? null,
      estimator: pick(r, "estimator", "estimator_name"),
      status: pick(r, "status", "stage"),
      region: pick(r, "region", "location", "state"),
      matchedOpportunityId: existing?.id ?? null,
      matchedOpportunityName: existing?.projectName ?? null,
    };
    if (existing) matched.push(summary);
    else newRows.push(summary);
  }

  return { totalRows: parsed.rows.length, matched, newRows, errors };
}

function mapHeavyBidStage(status: string | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (/won|awarded|active$/.test(s)) return "WON";
  if (/lost/.test(s)) return "LOST";
  if (/no\s*bid|nobid/.test(s)) return "NO_BID";
  if (/withdrawn|cancel/.test(s)) return "WITHDRAWN";
  if (/awaiting|pending|submitted/.test(s)) return "BID_SUBMITTED";
  if (/estimat/.test(s)) return "ESTIMATING";
  if (/review|itb/.test(s)) return "REVIEWING_ITB";
  if (/lead/.test(s)) return "LEAD";
  return null;
}

export async function commitHeavyBidImport(csv: string, actorUserId: number, fileName?: string) {
  const parsed = parseCSV(csv);
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const jobNumber = pick(r, "job_number", "job", "bid_number", "bid");
    const projectName = pick(r, "project_name", "job_name", "project", "description");
    const customerName = pick(r, "owner", "customer", "client") || "(unknown)";
    const bidTotal = parseMoney(pick(r, "bid_total", "total_bid", "estimated_value", "bid_amount", "total"));
    const bidDue = parseDate(pick(r, "bid_date", "bid_due", "due_date"));
    const region = pick(r, "region", "location", "state");
    const estimatorName = pick(r, "estimator", "estimator_name");
    const newStage = mapHeavyBidStage(pick(r, "status", "stage"));

    if (!projectName) {
      errors.push({ row: i + 2, reason: "Missing project name" });
      skipped++;
      continue;
    }

    // Resolve estimator by name (case-insensitive on fullName or username)
    let estimatorId: number | null = null;
    if (estimatorName) {
      const u = await prisma.user.findFirst({
        where: { isArchived: false, OR: [{ fullName: { contains: estimatorName, mode: "insensitive" } }, { username: estimatorName.toLowerCase() }] },
      });
      if (u) estimatorId = u.id;
    }

    // Match priority: heavyBidJobNumber → name+customer → name
    let existing = null as any;
    if (jobNumber) existing = await prisma.opportunity.findFirst({ where: { heavyBidJobNumber: jobNumber } });
    if (!existing) existing = await prisma.opportunity.findFirst({
      where: { projectName: { equals: projectName, mode: "insensitive" }, customerName: { equals: customerName, mode: "insensitive" } },
    });
    if (!existing) existing = await prisma.opportunity.findFirst({ where: { projectName: { equals: projectName, mode: "insensitive" } } });

    try {
      if (existing) {
        const data: any = {
          heavyBidJobNumber: jobNumber || existing.heavyBidJobNumber,
          lastActivityAt: new Date(),
          updatedById: actorUserId,
        };
        if (bidTotal != null) data.estimatedValueCents = bidTotal;
        if (bidDue) data.bidDueDate = bidDue;
        if (region) data.region = region;
        if (estimatorId) data.estimatorId = estimatorId;
        if (newStage && newStage !== existing.stage) {
          data.stage = newStage;
          data.stageChangedAt = new Date();
        }
        await prisma.opportunity.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        // create a fresh opportunity
        const year = new Date().getFullYear();
        const last = await prisma.opportunity.findFirst({
          where: { projectNumber: { startsWith: `TRC-${year}-` } },
          orderBy: { projectNumber: "desc" },
        });
        let n = 1;
        if (last) n = parseInt(last.projectNumber.split("-")[2], 10) + 1;
        const projectNumber = `TRC-${year}-${String(n).padStart(4, "0")}`;
        await prisma.opportunity.create({
          data: {
            projectNumber,
            projectName,
            customerName,
            estimatedValueCents: bidTotal ?? 0n,
            bidDueDate: bidDue,
            region: region || "",
            projectType: "",
            heavyBidJobNumber: jobNumber || null,
            estimatorId: estimatorId,
            stage: (newStage as any) || "ESTIMATING",
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        });
        created++;
      }
    } catch (e: any) {
      errors.push({ row: i + 2, reason: e.message || "DB write failed" });
      skipped++;
    }
  }

  const rec = await prisma.integrationImport.create({
    data: {
      source: "HEAVYBID",
      fileName: fileName || null,
      importedBy: actorUserId,
      rowCount: parsed.rows.length,
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
      errorCount: errors.length,
      errorsJson: errors.length ? JSON.stringify(errors) : null,
    },
  });
  return { id: rec.id, totalRows: parsed.rows.length, created, updated, skipped, errors };
}

/* ----------------- SAGE 300 CRE ----------------- */
// Expected CSV columns (Sage 300 CRE Job List export):
//   Job / Job Number
//   Job Name / Description
//   Customer / Owner
//   Contract Amount
//   Cost to Date / Job Cost
//   Billed to Date
//   Percent Complete (or computed)
//   Status

export async function previewSage300Import(csv: string) {
  const parsed = parseCSV(csv);
  const matched: any[] = [];
  const newRows: any[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const jobNumber = pick(r, "job", "job_number", "job_id");
    const projectName = pick(r, "job_name", "description", "project_name", "project");
    const customerName = pick(r, "customer", "owner", "client");
    const contractCents = parseMoney(pick(r, "contract_amount", "contract", "estimated_value"));
    const costToDate = parseMoney(pick(r, "cost_to_date", "job_cost", "actual_cost", "cost"));
    const billedToDate = parseMoney(pick(r, "billed_to_date", "billed", "invoiced"));
    const pctComplete = parsePct(pick(r, "percent_complete", "pct_complete", "complete"));

    if (!projectName && !jobNumber) {
      errors.push({ row: i + 2, reason: "Need project name or job number" });
      continue;
    }
    let existing = null as any;
    if (jobNumber) existing = await prisma.opportunity.findFirst({ where: { sage300JobNumber: jobNumber } });
    if (!existing && jobNumber) existing = await prisma.opportunity.findFirst({ where: { heavyBidJobNumber: jobNumber } });
    if (!existing && projectName) existing = await prisma.opportunity.findFirst({ where: { projectName: { equals: projectName, mode: "insensitive" } } });

    const summary = {
      rowIndex: i + 2,
      jobNumber,
      projectName,
      customerName,
      contractCents: contractCents?.toString() ?? null,
      costToDateCents: costToDate?.toString() ?? null,
      billedToDateCents: billedToDate?.toString() ?? null,
      percentComplete: pctComplete,
      matchedOpportunityId: existing?.id ?? null,
      matchedOpportunityName: existing?.projectName ?? null,
    };
    if (existing) matched.push(summary);
    else newRows.push(summary);
  }
  return { totalRows: parsed.rows.length, matched, newRows, errors };
}

export async function commitSage300Import(csv: string, actorUserId: number, fileName?: string) {
  const parsed = parseCSV(csv);
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const jobNumber = pick(r, "job", "job_number", "job_id");
    const projectName = pick(r, "job_name", "description", "project_name", "project");
    const customerName = pick(r, "customer", "owner", "client") || "(unknown)";
    const contractCents = parseMoney(pick(r, "contract_amount", "contract", "estimated_value"));
    const costToDate = parseMoney(pick(r, "cost_to_date", "job_cost", "actual_cost", "cost"));
    const billedToDate = parseMoney(pick(r, "billed_to_date", "billed", "invoiced"));
    const pctComplete = parsePct(pick(r, "percent_complete", "pct_complete", "complete"));
    const status = pick(r, "status", "job_status");

    if (!projectName && !jobNumber) {
      errors.push({ row: i + 2, reason: "Need project name or job number" });
      skipped++;
      continue;
    }

    // Compute actual margin if we have contract + cost
    let actualMargin: number | null = null;
    if (contractCents && costToDate && contractCents > 0n) {
      const c = Number(contractCents);
      const k = Number(costToDate);
      actualMargin = ((c - k) / c) * 100;
    }

    // Status → backlog status (Sage Active/Complete/Closed)
    let backlogStatus: any = undefined;
    if (status) {
      const s = status.toLowerCase();
      if (/complete|closed/.test(s)) backlogStatus = "COMPLETE";
      else if (/active|open/.test(s)) backlogStatus = "ACTIVE";
      else if (/hold/.test(s)) backlogStatus = "ON_HOLD";
      else if (/cancel/.test(s)) backlogStatus = "CANCELLED";
    }

    let existing = null as any;
    if (jobNumber) existing = await prisma.opportunity.findFirst({ where: { sage300JobNumber: jobNumber } });
    if (!existing && jobNumber) existing = await prisma.opportunity.findFirst({ where: { heavyBidJobNumber: jobNumber } });
    if (!existing && projectName) existing = await prisma.opportunity.findFirst({ where: { projectName: { equals: projectName, mode: "insensitive" } } });

    try {
      if (existing) {
        const data: any = {
          sage300JobNumber: jobNumber || existing.sage300JobNumber,
          costToDateCents: costToDate ?? existing.costToDateCents,
          billedToDateCents: billedToDate ?? existing.billedToDateCents,
          percentComplete: pctComplete ?? existing.percentComplete,
          actualMarginPct: actualMargin ?? existing.actualMarginPct,
          actualsAsOf: new Date(),
          lastActivityAt: new Date(),
          updatedById: actorUserId,
        };
        if (contractCents != null) data.actualValueCents = contractCents;
        if (backlogStatus) data.backlogStatus = backlogStatus;
        await prisma.opportunity.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        // Sage shouldn't typically be the source of new opportunities,
        // but we'll create a stub flagged Won (since it's in accounting).
        const year = new Date().getFullYear();
        const last = await prisma.opportunity.findFirst({
          where: { projectNumber: { startsWith: `TRC-${year}-` } },
          orderBy: { projectNumber: "desc" },
        });
        let n = 1;
        if (last) n = parseInt(last.projectNumber.split("-")[2], 10) + 1;
        const projectNumber = `TRC-${year}-${String(n).padStart(4, "0")}`;
        await prisma.opportunity.create({
          data: {
            projectNumber,
            projectName: projectName || `Sage import ${jobNumber}`,
            customerName,
            estimatedValueCents: contractCents ?? 0n,
            actualValueCents: contractCents,
            sage300JobNumber: jobNumber || null,
            stage: "WON",
            decidedAt: new Date(),
            region: "",
            projectType: "",
            costToDateCents: costToDate,
            billedToDateCents: billedToDate,
            percentComplete: pctComplete,
            actualMarginPct: actualMargin,
            actualsAsOf: new Date(),
            backlogStatus: backlogStatus ?? "ACTIVE",
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        });
        created++;
      }
    } catch (e: any) {
      errors.push({ row: i + 2, reason: e.message || "DB write failed" });
      skipped++;
    }
  }

  const rec = await prisma.integrationImport.create({
    data: {
      source: "SAGE300",
      fileName: fileName || null,
      importedBy: actorUserId,
      rowCount: parsed.rows.length,
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
      errorCount: errors.length,
      errorsJson: errors.length ? JSON.stringify(errors) : null,
    },
  });
  return { id: rec.id, totalRows: parsed.rows.length, created, updated, skipped, errors };
}
