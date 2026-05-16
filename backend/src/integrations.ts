// HCSS HeavyBid + Sage 300 CRE CSV/Excel import + preview.
// These services don't have a public API; the realistic v1 is users export
// CSVs from HeavyBid/Sage and we ingest them. Auto-match by job number /
// project name; surface unmatched rows for manual review before commit.

import { prisma } from "./db";
import { parseCSV, parseMoney, parsePct, parseDate } from "./csv";
import { matchCustomer, normalizeName, nextCustomerNumber } from "./customer-match";

type Row = Record<string, string>;

const pick = (r: Row, ...keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== "") return v;
  }
  return "";
};

const truthy = (v: string) => /^(y|yes|true|1|t)$/i.test(v.trim());

function mapStage(status: string | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase().replace(/[-_\s]+/g, "");
  if (/won|awarded/.test(s)) return "WON";
  if (/lost/.test(s)) return "LOST";
  if (/nobid/.test(s)) return "NO_BID";
  if (/withdrawn|cancel/.test(s)) return "WITHDRAWN";
  if (/awaiting|pending/.test(s)) return "AWAITING_DECISION";
  if (/submitted/.test(s)) return "BID_SUBMITTED";
  if (/estimat/.test(s)) return "ESTIMATING";
  if (/gonogo|going/.test(s)) return "GO_NO_GO";
  if (/review|itb/.test(s)) return "REVIEWING_ITB";
  if (/lead/.test(s)) return "LEAD";
  return null;
}

function mapCustomerType(s: string | undefined): string | null {
  if (!s) return null;
  const v = s.toLowerCase();
  if (/gc|general\s*contractor/.test(v)) return "GC";
  if (/developer/.test(v)) return "DEVELOPER";
  if (/gov/.test(v)) return "GOVERNMENT";
  if (/owner|direct/.test(v)) return "OWNER_DIRECT";
  return null;
}

function mapTier(s: string | undefined): string | null {
  if (!s) return null;
  const v = s.toLowerCase();
  if (/platinum/.test(v)) return "PLATINUM";
  if (/gold/.test(v)) return "GOLD";
  if (/silver/.test(v)) return "SILVER";
  if (/new/.test(v)) return "NEW";
  return null;
}

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

const mapHeavyBidStage = mapStage;

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

/* ===================== BULK DATA LOAD (generic templates) =====================
 * Pre-built CSV templates per entity for one-time historical data backfill.
 * Templates intentionally accept flexible headers so users can paste from
 * their own spreadsheets without reformatting.
 */

const FORMATS = {
  pipeline: {
    filename: "redland-pipeline-template.csv",
    headers: [
      "Project Name",            // required
      "Customer Number",         // optional — preferred over Customer Name when present
      "Customer Name",           // required (used when Customer Number is blank)
      "Customer Type",           // GC | Developer | Government | Owner-Direct
      "Project Type",
      "Region",
      "Estimated Value",         // dollars
      "Bid Margin %",
      "Expected Margin %",
      "Bid Due Date",            // YYYY-MM-DD
      "Estimated Start Date",
      "Duration (months)",
      "Stage",                   // Lead / Reviewing ITB / Go-No-Go / Estimating / Bid Submitted / Awaiting Decision / Won / Lost / No Bid / Withdrawn
      "Bonding Required",        // Y/N
      "Bond Amount",
      "Estimator",               // user full name or username
      "PM",
      "Source",
      "Competitive",             // Y/N
      "Last Look",               // Y/N
      "Actual Value",            // when Stage = Won
      "Winning Bidder",          // when Stage = Lost
      "Winning Bid Amount",      // when Stage = Lost
      "Loss Reason",
      "No-Bid Reason",
      "HeavyBid Job #",
      "Sage Job #",
      "Pipeline Board",          // main / public / negotiated / private
      "Notes",                   // creates an initial note
    ],
    example: [
      "Coral Gables Mixed-Use Phase 2",
      "",
      "Suffolk Construction",
      "GC",
      "Mixed Use",
      "SE Florida",
      "4250000",
      "6",
      "8",
      "2026-06-15",
      "2026-09-01",
      "12",
      "Estimating",
      "N",
      "",
      "David Merring",
      "",
      "Repeat Customer",
      "Y",
      "Y",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "main",
      "Pulled from Q1 2026 tracking sheet",
    ],
  },
  customers: {
    filename: "redland-customers-template.csv",
    headers: [
      "Customer Number",         // optional — leave blank for new customers; auto-generates as CUS-####
      "Company Name",            // required
      "Customer Type",           // GC | Developer | Government | Owner-Direct
      "Tier",                    // Platinum | Gold | Silver | New
      "Primary Contact",
      "Phone",
      "Email",
      "Last Look",               // Y/N
      "Aliases",                 // pipe-separated alternate names: e.g. "Suffolk|Suffolk Inc|Suffolk Constr."
      "Notes",
    ],
    example: ["", "Suffolk Construction", "GC", "Platinum", "John Roberts", "555-123-4567", "jroberts@suffolk.com", "Y", "Suffolk|Suffolk Inc|Suffolk Construction Inc", "Repeat customer since 2018"],
  },
  contacts: {
    filename: "redland-contacts-template.csv",
    headers: [
      "Full Name",               // required
      "Title",
      "Email",
      "Phone",
      "Current Employer",        // matches a Customer by company name (case-insensitive)
      "Notes",
    ],
    example: ["John Roberts", "Pre-Construction Manager", "jroberts@suffolk.com", "555-123-4567", "Suffolk Construction", "Decision maker on negotiated work"],
  },
  compliance: {
    filename: "redland-compliance-template.csv",
    headers: [
      "Type",                    // COI | W9 | LICENSE | MBE | WBE | DBE | OTHER
      "Label",
      "Customer",                // optional; matches Customer by company name
      "Expires",                 // YYYY-MM-DD
      "Notes",
    ],
    example: ["COI", "General Liability 2026", "Suffolk Construction", "2026-12-31", "$5M aggregate"],
  },
} as const;

export type BulkEntity = keyof typeof FORMATS;

export function generateTemplate(entity: BulkEntity): { filename: string; csv: string } {
  const fmt = FORMATS[entity];
  const esc = (v: string) => {
    if (!v) return "";
    if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [fmt.headers.map(esc).join(","), fmt.example.map(esc).join(",")];
  return { filename: fmt.filename, csv: lines.join("\n") + "\n" };
}

/* ----- Pipeline bulk import ----- */
export async function previewPipelineImport(csv: string) {
  const parsed = parseCSV(csv);
  const matched: any[] = [];
  const newRows: any[] = [];
  const errors: { row: number; reason: string }[] = [];
  const unknownEstimators = new Set<string>();
  // Per-customer-name resolution result, surfaced for the UI to confirm
  // mappings before commit.
  const customerSuggestions: Record<string, any> = {};

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const projectName = pick(r, "project_name", "project", "job_name", "name");
    const customerName = pick(r, "customer_name", "customer", "owner", "client");
    const customerNumber = pick(r, "customer_number", "customer_no", "cus_number", "cus");
    const hbJob = pick(r, "heavybid_job", "hb_job", "heavy_bid_job");
    const sageJob = pick(r, "sage_job", "sage_300_job", "sage300_job");

    if (!projectName) { errors.push({ row: i + 2, reason: "Missing Project Name" }); continue; }
    if (!customerName && !customerNumber) { errors.push({ row: i + 2, reason: "Missing Customer Name (or Customer Number)" }); continue; }

    // opportunity match
    let existing = null as any;
    if (hbJob) existing = await prisma.opportunity.findFirst({ where: { heavyBidJobNumber: hbJob } });
    if (!existing && sageJob) existing = await prisma.opportunity.findFirst({ where: { sage300JobNumber: sageJob } });
    if (!existing) existing = await prisma.opportunity.findFirst({
      where: { projectName: { equals: projectName, mode: "insensitive" }, customerName: { equals: customerName, mode: "insensitive" } },
    });
    if (!existing) existing = await prisma.opportunity.findFirst({ where: { projectName: { equals: projectName, mode: "insensitive" } } });

    // estimator check
    const estimatorName = pick(r, "estimator", "estimator_name");
    if (estimatorName) {
      const u = await prisma.user.findFirst({
        where: { isArchived: false, OR: [{ fullName: { contains: estimatorName, mode: "insensitive" } }, { username: estimatorName.toLowerCase() }] },
      });
      if (!u) unknownEstimators.add(estimatorName);
    }

    // customer match using the smart resolver — cached per name to avoid repeating
    const key = customerNumber ? `#${customerNumber}` : (customerName || "").trim();
    if (key && !(key in customerSuggestions)) {
      const m = await matchCustomer(customerName, customerNumber);
      customerSuggestions[key] = {
        rawName: customerName,
        customerNumber: customerNumber || null,
        match: m.customer,
        matchedBy: m.matchedBy,
        suggestions: m.suggestions,
      };
    }

    const value = parseMoney(pick(r, "estimated_value", "value", "bid_total", "contract_amount"));
    const summary = {
      rowIndex: i + 2,
      projectName,
      customerName,
      customerNumber: customerNumber || null,
      customerKey: key,
      estimatedValueCents: value?.toString() ?? null,
      stage: mapStage(pick(r, "stage", "status")) || "LEAD",
      bidDueDate: parseDate(pick(r, "bid_due_date", "bid_due", "due_date"))?.toISOString() ?? null,
      matchedOpportunityId: existing?.id ?? null,
      matchedOpportunityName: existing?.projectName ?? null,
    };
    if (existing) matched.push(summary);
    else newRows.push(summary);
  }
  return {
    totalRows: parsed.rows.length,
    matched,
    newRows,
    errors,
    customerSuggestions,
    unknownEstimators: Array.from(unknownEstimators),
  };
}

export async function commitPipelineImport(
  csv: string,
  actorUserId: number,
  fileName?: string,
  customerMappings?: Record<string, number>, // customerKey → customerId override (from preview UI)
) {
  const parsed = parseCSV(csv);
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const projectName = pick(r, "project_name", "project", "job_name", "name");
    const customerName = pick(r, "customer_name", "customer", "owner", "client");
    const customerNumberRaw = pick(r, "customer_number", "customer_no", "cus_number", "cus");
    if (!projectName || (!customerName && !customerNumberRaw)) {
      errors.push({ row: i + 2, reason: "Missing project name or customer" });
      skipped++;
      continue;
    }

    // resolve linked records
    const estimatorName = pick(r, "estimator", "estimator_name");
    let estimatorId: number | null = null;
    if (estimatorName) {
      const u = await prisma.user.findFirst({
        where: { isArchived: false, OR: [{ fullName: { contains: estimatorName, mode: "insensitive" } }, { username: estimatorName.toLowerCase() }] },
      });
      if (u) estimatorId = u.id;
    }
    const pmName = pick(r, "pm", "project_manager");
    let pmId: number | null = null;
    if (pmName) {
      const u = await prisma.user.findFirst({
        where: { isArchived: false, OR: [{ fullName: { contains: pmName, mode: "insensitive" } }, { username: pmName.toLowerCase() }] },
      });
      if (u) pmId = u.id;
    }
    // Customer resolution: explicit mapping > Customer Number > smart name match.
    // If no match, auto-create the customer (with auto-assigned CUS-####).
    let customerId: number | null = null;
    let resolvedCustomerName = customerName;
    const customerKey = customerNumberRaw ? `#${customerNumberRaw}` : (customerName || "").trim();
    if (customerMappings && customerKey && customerMappings[customerKey]) {
      const mapped = await prisma.customer.findUnique({ where: { id: customerMappings[customerKey] } });
      if (mapped) {
        customerId = mapped.id;
        resolvedCustomerName = mapped.companyName;
        // Save the original spelling as an alias so future imports auto-match
        if (customerName && normalizeName(customerName) !== normalizeName(mapped.companyName)) {
          try {
            await prisma.customerAlias.create({ data: { customerId: mapped.id, alias: customerName, normalized: normalizeName(customerName) } });
          } catch { /* duplicate alias — ignore */ }
        }
      }
    }
    if (!customerId) {
      const m = await matchCustomer(customerName, customerNumberRaw);
      if (m.customer) {
        customerId = m.customer.id;
        resolvedCustomerName = m.customer.companyName;
      } else if (customerName) {
        // Auto-create
        const num = await nextCustomerNumber();
        const c = await prisma.customer.create({
          data: { customerNumber: num, companyName: customerName, customerType: mapCustomerType(pick(r, "customer_type")) as any || "GC", createdById: actorUserId, updatedById: actorUserId },
        });
        customerId = c.id;
        resolvedCustomerName = c.companyName;
      }
    }

    const hbJob = pick(r, "heavybid_job", "hb_job", "heavy_bid_job") || null;
    const sageJob = pick(r, "sage_job", "sage_300_job", "sage300_job") || null;
    const stage = mapStage(pick(r, "stage", "status")) || "LEAD";
    const valueCents = parseMoney(pick(r, "estimated_value", "value", "bid_total", "contract_amount")) ?? 0n;
    const actualCents = parseMoney(pick(r, "actual_value", "won_amount"));
    const winningBidCents = parseMoney(pick(r, "winning_bid_amount", "winning_bid"));
    const bondCents = parseMoney(pick(r, "bond_amount"));
    const bonding = truthy(pick(r, "bonding_required", "bonding"));
    const competitive = pick(r, "competitive") === "" ? true : truthy(pick(r, "competitive"));
    const lastLook = truthy(pick(r, "last_look"));
    const bidMarginPct = parsePct(pick(r, "bid_margin_%", "bid_margin")) ?? 6;
    const expectedMarginPct = parsePct(pick(r, "expected_margin_%", "expected_margin"));
    const duration = pick(r, "duration_months", "duration_months_", "duration");

    // match
    let existing = null as any;
    if (hbJob) existing = await prisma.opportunity.findFirst({ where: { heavyBidJobNumber: hbJob } });
    if (!existing && sageJob) existing = await prisma.opportunity.findFirst({ where: { sage300JobNumber: sageJob } });
    if (!existing) existing = await prisma.opportunity.findFirst({
      where: { projectName: { equals: projectName, mode: "insensitive" }, customerName: { equals: customerName, mode: "insensitive" } },
    });
    if (!existing) existing = await prisma.opportunity.findFirst({ where: { projectName: { equals: projectName, mode: "insensitive" } } });

    const baseData: any = {
      projectName,
      customerName: resolvedCustomerName || customerName,
      customerId: customerId,
      customerType: mapCustomerType(pick(r, "customer_type")) || "GC",
      projectType: pick(r, "project_type", "type") || "",
      region: pick(r, "region", "location") || "",
      estimatedValueCents: valueCents,
      actualValueCents: actualCents,
      winningBidCents,
      winningBidder: pick(r, "winning_bidder") || null,
      bidMarginPct,
      expectedMarginPct,
      bidDueDate: parseDate(pick(r, "bid_due_date", "bid_due", "due_date")),
      estimatedStartDate: parseDate(pick(r, "estimated_start_date", "start_date")),
      estimatedDurationMonths: duration && !isNaN(parseInt(duration, 10)) ? parseInt(duration, 10) : null,
      bondingRequired: bonding,
      bondAmountCents: bondCents,
      estimatorId,
      pmId,
      source: pick(r, "source") || null,
      competitive,
      lastLook,
      lossReason: pick(r, "loss_reason") || null,
      noBidReason: pick(r, "no_bid_reason") || null,
      heavyBidJobNumber: hbJob,
      sage300JobNumber: sageJob,
      pipelineBoard: pick(r, "pipeline_board", "board") || "main",
      stage,
      stageChangedAt: new Date(),
      lastActivityAt: new Date(),
      updatedById: actorUserId,
    };
    if (["WON", "LOST", "NO_BID", "WITHDRAWN"].includes(stage) && !existing?.decidedAt) {
      baseData.decidedAt = new Date();
    }
    if (stage === "BID_SUBMITTED" && !existing?.bidSubmittedAt) {
      baseData.bidSubmittedAt = new Date();
    }

    try {
      let opId: number;
      if (existing) {
        const u = await prisma.opportunity.update({ where: { id: existing.id }, data: baseData });
        opId = u.id;
        updated++;
      } else {
        // generate project number
        const year = new Date().getFullYear();
        const last = await prisma.opportunity.findFirst({
          where: { projectNumber: { startsWith: `TRC-${year}-` } },
          orderBy: { projectNumber: "desc" },
        });
        let n = 1;
        if (last) n = parseInt(last.projectNumber.split("-")[2], 10) + 1;
        const c = await prisma.opportunity.create({
          data: { ...baseData, projectNumber: `TRC-${year}-${String(n).padStart(4, "0")}`, createdById: actorUserId },
        });
        opId = c.id;
        created++;
      }
      // optional initial note
      const notes = pick(r, "notes", "comments", "note");
      if (notes) {
        await prisma.opportunityNote.create({ data: { opportunityId: opId, authorId: actorUserId, body: notes } });
      }
    } catch (e: any) {
      errors.push({ row: i + 2, reason: e.message || "DB write failed" });
      skipped++;
    }
  }

  const rec = await prisma.integrationImport.create({
    data: {
      source: "BULK_PIPELINE",
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

/* ----- Customers bulk import ----- */
export async function previewCustomersImport(csv: string) {
  const parsed = parseCSV(csv);
  const matched: any[] = [];
  const newRows: any[] = [];
  const errors: { row: number; reason: string }[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const companyName = pick(r, "company_name", "company", "customer", "name");
    const customerNumber = pick(r, "customer_number", "customer_no", "cus_number", "cus");
    if (!companyName && !customerNumber) {
      errors.push({ row: i + 2, reason: "Need Company Name or Customer Number" });
      continue;
    }
    const m = await matchCustomer(companyName, customerNumber);
    const summary = {
      rowIndex: i + 2,
      companyName,
      customerNumber: customerNumber || null,
      customerType: mapCustomerType(pick(r, "customer_type", "type")),
      tier: mapTier(pick(r, "tier")),
      matchedCustomerId: m.customer?.id ?? null,
      matchedBy: m.matchedBy,
    };
    if (m.customer) matched.push(summary);
    else newRows.push(summary);
  }
  return { totalRows: parsed.rows.length, matched, newRows, errors };
}

export async function commitCustomersImport(csv: string, actorUserId: number, fileName?: string) {
  const parsed = parseCSV(csv);
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const companyName = pick(r, "company_name", "company", "customer", "name");
    const customerNumber = pick(r, "customer_number", "customer_no", "cus_number", "cus");
    if (!companyName && !customerNumber) { errors.push({ row: i + 2, reason: "Need Company Name or Customer Number" }); skipped++; continue; }
    const aliasesRaw = pick(r, "aliases", "alias", "also_known_as", "dba");
    const aliases = aliasesRaw ? aliasesRaw.split(/[|;]/).map((s) => s.trim()).filter(Boolean) : [];
    const data: any = {
      companyName: companyName || "(unknown)",
      primaryContact: pick(r, "primary_contact", "contact") || null,
      phone: pick(r, "phone") || null,
      email: pick(r, "email") || null,
      customerType: mapCustomerType(pick(r, "customer_type", "type")) || "GC",
      tier: mapTier(pick(r, "tier")) || "NEW",
      lastLook: truthy(pick(r, "last_look")),
      notes: pick(r, "notes") || null,
    };
    try {
      const m = await matchCustomer(companyName, customerNumber);
      let cId: number;
      if (m.customer) {
        await prisma.customer.update({ where: { id: m.customer.id }, data: { ...data, updatedById: actorUserId } });
        cId = m.customer.id;
        updated++;
      } else {
        const num = customerNumber || (await nextCustomerNumber());
        const c = await prisma.customer.create({
          data: { ...data, customerNumber: num, createdById: actorUserId, updatedById: actorUserId },
        });
        cId = c.id;
        created++;
      }
      // Sync aliases (additive — never remove existing)
      for (const a of aliases) {
        try {
          await prisma.customerAlias.create({ data: { customerId: cId, alias: a, normalized: normalizeName(a) } });
        } catch { /* unique conflict — already exists, skip */ }
      }
    } catch (e: any) {
      errors.push({ row: i + 2, reason: e.message || "DB write failed" });
      skipped++;
    }
  }
  const rec = await prisma.integrationImport.create({
    data: { source: "BULK_CUSTOMERS", fileName: fileName || null, importedBy: actorUserId, rowCount: parsed.rows.length, createdCount: created, updatedCount: updated, skippedCount: skipped, errorCount: errors.length, errorsJson: errors.length ? JSON.stringify(errors) : null },
  });
  return { id: rec.id, totalRows: parsed.rows.length, created, updated, skipped, errors };
}

/* ----- Contacts bulk import ----- */
export async function previewContactsImport(csv: string) {
  const parsed = parseCSV(csv);
  const matched: any[] = [];
  const newRows: any[] = [];
  const errors: { row: number; reason: string }[] = [];
  const unknownCustomers = new Set<string>();
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const fullName = pick(r, "full_name", "name", "contact_name");
    if (!fullName) { errors.push({ row: i + 2, reason: "Missing Full Name" }); continue; }
    const email = pick(r, "email");
    const employer = pick(r, "current_employer", "employer", "company");
    if (employer) {
      const c = await prisma.customer.findFirst({ where: { companyName: { equals: employer, mode: "insensitive" } } });
      if (!c) unknownCustomers.add(employer);
    }
    let existing = null as any;
    if (email) existing = await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!existing && employer) {
      const cust = await prisma.customer.findFirst({ where: { companyName: { equals: employer, mode: "insensitive" } } });
      if (cust) existing = await prisma.contact.findFirst({ where: { fullName: { equals: fullName, mode: "insensitive" }, currentCustomerId: cust.id } });
    }
    if (!existing) existing = await prisma.contact.findFirst({ where: { fullName: { equals: fullName, mode: "insensitive" } } });
    const summary = { rowIndex: i + 2, fullName, email, employer, matchedContactId: existing?.id ?? null };
    if (existing) matched.push(summary);
    else newRows.push(summary);
  }
  return { totalRows: parsed.rows.length, matched, newRows, errors, unknownCustomers: Array.from(unknownCustomers) };
}

export async function commitContactsImport(csv: string, actorUserId: number, fileName?: string) {
  const parsed = parseCSV(csv);
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const fullName = pick(r, "full_name", "name", "contact_name");
    if (!fullName) { errors.push({ row: i + 2, reason: "Missing Full Name" }); skipped++; continue; }
    const email = pick(r, "email") || null;
    const phone = pick(r, "phone") || null;
    const title = pick(r, "title") || null;
    const notes = pick(r, "notes") || null;
    const employer = pick(r, "current_employer", "employer", "company");
    let currentCustomerId: number | null = null;
    let employerCust: any = null;
    if (employer) {
      employerCust = await prisma.customer.findFirst({ where: { companyName: { equals: employer, mode: "insensitive" } } });
      if (employerCust) currentCustomerId = employerCust.id;
    }
    try {
      let existing = null as any;
      if (email) existing = await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
      if (!existing && employerCust) existing = await prisma.contact.findFirst({ where: { fullName: { equals: fullName, mode: "insensitive" }, currentCustomerId: employerCust.id } });
      if (!existing) existing = await prisma.contact.findFirst({ where: { fullName: { equals: fullName, mode: "insensitive" } } });

      if (existing) {
        const data: any = { title, email, phone, notes };
        if (currentCustomerId !== null) data.currentCustomerId = currentCustomerId;
        await prisma.contact.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        const c = await prisma.contact.create({
          data: { fullName, title, email, phone, notes, currentCustomerId },
        });
        if (currentCustomerId && employerCust) {
          await prisma.contactEmployment.create({
            data: { contactId: c.id, customerId: currentCustomerId, customerName: employerCust.companyName, title, startedAt: new Date() },
          });
        }
        created++;
      }
    } catch (e: any) {
      errors.push({ row: i + 2, reason: e.message || "DB write failed" });
      skipped++;
    }
  }
  const rec = await prisma.integrationImport.create({
    data: { source: "BULK_CONTACTS", fileName: fileName || null, importedBy: actorUserId, rowCount: parsed.rows.length, createdCount: created, updatedCount: updated, skippedCount: skipped, errorCount: errors.length, errorsJson: errors.length ? JSON.stringify(errors) : null },
  });
  return { id: rec.id, totalRows: parsed.rows.length, created, updated, skipped, errors };
}

/* ----- Compliance bulk import ----- */
export async function previewComplianceImport(csv: string) {
  const parsed = parseCSV(csv);
  const newRows: any[] = [];
  const errors: { row: number; reason: string }[] = [];
  const unknownCustomers = new Set<string>();
  const ALLOWED = ["COI", "W9", "LICENSE", "MBE", "WBE", "DBE", "OTHER"];
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const docType = pick(r, "type", "doc_type").toUpperCase();
    if (!ALLOWED.includes(docType)) {
      errors.push({ row: i + 2, reason: `Type must be one of: ${ALLOWED.join(", ")}` });
      continue;
    }
    const cust = pick(r, "customer", "company");
    if (cust) {
      const c = await prisma.customer.findFirst({ where: { companyName: { equals: cust, mode: "insensitive" } } });
      if (!c) unknownCustomers.add(cust);
    }
    newRows.push({
      rowIndex: i + 2,
      docType,
      label: pick(r, "label") || null,
      customerName: cust || null,
      expiresAt: parseDate(pick(r, "expires", "expiration", "expires_at"))?.toISOString() ?? null,
    });
  }
  return { totalRows: parsed.rows.length, matched: [], newRows, errors, unknownCustomers: Array.from(unknownCustomers) };
}

export async function commitComplianceImport(csv: string, actorUserId: number, fileName?: string) {
  const parsed = parseCSV(csv);
  let created = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];
  const ALLOWED = ["COI", "W9", "LICENSE", "MBE", "WBE", "DBE", "OTHER"];
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const docType = pick(r, "type", "doc_type").toUpperCase();
    if (!ALLOWED.includes(docType)) {
      errors.push({ row: i + 2, reason: `Type must be one of: ${ALLOWED.join(", ")}` });
      skipped++;
      continue;
    }
    const cust = pick(r, "customer", "company");
    let customerId: number | null = null;
    if (cust) {
      const c = await prisma.customer.findFirst({ where: { companyName: { equals: cust, mode: "insensitive" } } });
      if (c) customerId = c.id;
    }
    try {
      await prisma.complianceDoc.create({
        data: {
          docType,
          label: pick(r, "label") || null,
          customerId,
          expiresAt: parseDate(pick(r, "expires", "expiration", "expires_at")),
          notes: pick(r, "notes") || null,
        },
      });
      created++;
    } catch (e: any) {
      errors.push({ row: i + 2, reason: e.message || "DB write failed" });
      skipped++;
    }
  }
  const rec = await prisma.integrationImport.create({
    data: { source: "BULK_COMPLIANCE", fileName: fileName || null, importedBy: actorUserId, rowCount: parsed.rows.length, createdCount: created, updatedCount: 0, skippedCount: skipped, errorCount: errors.length, errorsJson: errors.length ? JSON.stringify(errors) : null },
  });
  return { id: rec.id, totalRows: parsed.rows.length, created, updated: 0, skipped, errors };
}
