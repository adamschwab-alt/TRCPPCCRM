import React, { useEffect, useRef, useState } from "react";
import { api, fmtDateTime } from "../api";
import { useAuth } from "../auth";

type Source = "heavybid" | "sage300" | "bulk-pipeline" | "bulk-customers" | "bulk-contacts" | "bulk-compliance";

const TOKEN_KEY = "redland_token";

export default function Integrations() {
  const { user } = useAuth();
  const [imports, setImports] = useState<any[]>([]);

  async function loadImports() {
    try { setImports(await api("/api/integrations/imports")); } catch {}
  }
  useEffect(() => { loadImports(); }, []);

  const canImport = user?.role === "ADMIN" || user?.role === "LEADERSHIP" || user?.role === "ESTIMATOR";

  function dl(path: string) {
    const a = document.createElement("a");
    a.href = path;
    a.click();
  }

  // For authenticated file downloads we need to attach the bearer token; use fetch + blob.
  async function authDownload(path: string, filename?: string) {
    const tok = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(path, { headers: { Authorization: `Bearer ${tok}` } });
    if (!res.ok) { alert("Download failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-redland-charcoal">Integrations & Exports</h1>
        <p className="text-sm text-gray-600">Import from HCSS HeavyBid + Sage 300, and export everything to Excel.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {canImport && (
          <ImportPanel
            previewPath="/api/integrations/heavybid/preview"
            importPath="/api/integrations/heavybid/import"
            title="HCSS HeavyBid"
            blurb="Upload a HeavyBid Bid Summary CSV. Auto-matches existing opportunities by Job Number, Project Name + Customer, or Project Name. New rows create new opportunities; matched rows update bid total, due date, region, estimator, and stage."
            sampleHeaders={["Job Number", "Project Name", "Owner", "Bid Total", "Bid Due", "Estimator", "Status", "Region"]}
            onComplete={loadImports}
          />
        )}
        {canImport && (
          <ImportPanel
            previewPath="/api/integrations/sage300/preview"
            importPath="/api/integrations/sage300/import"
            title="Sage 300 CRE"
            blurb="Upload a Sage 300 Job List export. Pulls cost-to-date, billed-to-date, % complete, and computes actual margin against contract — surfaces on Backlog + Opportunity detail."
            sampleHeaders={["Job", "Job Name", "Customer", "Contract Amount", "Cost to Date", "Billed to Date", "Percent Complete", "Status"]}
            onComplete={loadImports}
          />
        )}
      </div>

      {canImport && (
        <div>
          <h2 className="font-bold text-redland-charcoal mb-1">Bulk data load (initial backfill)</h2>
          <p className="text-sm text-gray-600 mb-3">
            Backfill pre-existing data from spreadsheets. Download the template, fill it in, upload it back — preview before committing.
            Customer and estimator names are matched automatically; unknown ones are surfaced in the preview so you can catch typos before they create duplicates.
          </p>
          <div className="grid lg:grid-cols-2 gap-4">
            <ImportPanel
              templatePath="/api/integrations/template/pipeline"
              previewPath="/api/integrations/bulk/pipeline/preview"
              importPath="/api/integrations/bulk/pipeline/import"
              title="Pipeline (Bids / Backlog / Wins / Losses)"
              blurb="Load historical and active opportunities — works for the full pipeline (bids in progress, awaiting decision, won, lost, no-bid). Match priority: HeavyBid Job # → Sage Job # → Project Name + Customer → Project Name."
              sampleHeaders={["Project Name", "Customer Name", "Estimated Value", "Bid Due Date", "Stage", "Estimator", "Region", "..."]}
              showUnknownLists
              onComplete={loadImports}
            />
            <ImportPanel
              templatePath="/api/integrations/template/customers"
              previewPath="/api/integrations/bulk/customers/preview"
              importPath="/api/integrations/bulk/customers/import"
              title="Customers"
              blurb="Upload your existing customer master list. Matches existing records by Company Name (case-insensitive) and updates them; everything else is created fresh."
              sampleHeaders={["Company Name", "Customer Type", "Tier", "Primary Contact", "Email", "Phone", "Last Look"]}
              onComplete={loadImports}
            />
            <ImportPanel
              templatePath="/api/integrations/template/contacts"
              previewPath="/api/integrations/bulk/contacts/preview"
              importPath="/api/integrations/bulk/contacts/import"
              title="Contacts"
              blurb="Upload your contact list (GC PMs, owner reps, estimators on the other side). Current Employer is matched to an existing Customer by company name — load Customers first if you haven't yet."
              sampleHeaders={["Full Name", "Title", "Email", "Phone", "Current Employer", "Notes"]}
              showUnknownLists
              onComplete={loadImports}
            />
            <ImportPanel
              templatePath="/api/integrations/template/compliance"
              previewPath="/api/integrations/bulk/compliance/preview"
              importPath="/api/integrations/bulk/compliance/import"
              title="Compliance Documents"
              blurb="Upload your COI / W-9 / license / MBE-WBE-DBE tracker. Type must be one of: COI, W9, LICENSE, MBE, WBE, DBE, OTHER. Customer matching is optional."
              sampleHeaders={["Type", "Label", "Customer", "Expires", "Notes"]}
              showUnknownLists
              onComplete={loadImports}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="font-bold text-redland-charcoal mb-2">Exports</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ExportCard title="Pipeline" desc="Full opportunity list with all fields + actuals" onClick={() => authDownload("/api/exports/pipeline.xlsx")} />
          <ExportCard title="Customers" desc="Customer list with tiers, contacts, owners" onClick={() => authDownload("/api/exports/customers.xlsx")} />
          <ExportCard title="Backlog" desc="Won projects with Sage actuals + variance" onClick={() => authDownload("/api/exports/backlog.xlsx")} />
          <ExportCard title="Contacts" desc="Contacts + employment history (2 sheets)" onClick={() => authDownload("/api/exports/contacts.xlsx")} />
          <ExportCard title="Compliance" desc="COI / W-9 / License / MBE-WBE-DBE tracking" onClick={() => authDownload("/api/exports/compliance.xlsx")} />
          {(user?.role === "ADMIN" || user?.role === "LEADERSHIP") && (
            <ExportCard title="Audit Log" desc="Last 5,000 audit events" onClick={() => authDownload("/api/exports/audit-log.xlsx")} />
          )}
          <ExportCard title="HeavyBid CSV" desc="Round-trip CSV in HeavyBid format" onClick={() => authDownload("/api/exports/heavybid.csv")} />
          <ExportCard title="Sage 300 CSV" desc="Won projects in Sage Job-List format" onClick={() => authDownload("/api/exports/sage300.csv")} />
        </div>
      </div>

      <div>
        <h2 className="font-bold text-redland-charcoal mb-2">Recent imports</h2>
        {imports.length === 0 ? (
          <div className="text-sm text-gray-500">No imports yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-redland-charcoal text-white">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-right">Rows</th>
                  <th className="px-3 py-2 text-right">Created</th>
                  <th className="px-3 py-2 text-right">Updated</th>
                  <th className="px-3 py-2 text-right">Skipped</th>
                  <th className="px-3 py-2 text-right">Errors</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDateTime(i.createdAt)}</td>
                    <td className="px-3 py-2 font-semibold">{i.source}</td>
                    <td className="px-3 py-2 text-xs">{i.fileName || "(no name)"}</td>
                    <td className="px-3 py-2 text-right">{i.rowCount}</td>
                    <td className="px-3 py-2 text-right text-green-700">{i.createdCount}</td>
                    <td className="px-3 py-2 text-right">{i.updatedCount}</td>
                    <td className="px-3 py-2 text-right">{i.skippedCount}</td>
                    <td className={`px-3 py-2 text-right ${i.errorCount > 0 ? "text-red-700 font-bold" : ""}`}>{i.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ExportCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 text-left hover:border-redland-red transition-colors">
      <div className="font-bold text-redland-charcoal">{title}</div>
      <div className="text-xs text-gray-600 mt-1">{desc}</div>
      <div className="text-xs text-redland-red font-semibold mt-2">Download →</div>
    </button>
  );
}

function ImportPanel({ previewPath, importPath, templatePath, title, blurb, sampleHeaders, showUnknownLists, onComplete }: {
  previewPath: string;
  importPath: string;
  templatePath?: string;
  title: string;
  blurb: string;
  sampleHeaders: string[];
  showUnknownLists?: boolean;
  onComplete: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [customerMappings, setCustomerMappings] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onFile(f: File | null) {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(reader.result as string);
      setPreview(null);
      setResult(null);
    };
    reader.readAsText(f);
  }

  async function downloadTemplate() {
    if (!templatePath) return;
    const tok = localStorage.getItem("redland_token");
    const res = await fetch(templatePath, { headers: { Authorization: `Bearer ${tok}` } });
    if (!res.ok) { alert("Template download failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doPreview() {
    if (!csv) return;
    setBusy(true);
    try {
      const r = await api(previewPath, { method: "POST", body: JSON.stringify({ csv }) });
      setPreview(r);
    } catch (e: any) {
      alert(e.message || "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!csv) return;
    if (!confirm(`Import ${preview?.totalRows || "all"} rows from ${title}?`)) return;
    setBusy(true);
    try {
      const r = await api<any>(importPath, {
        method: "POST",
        body: JSON.stringify({ csv, fileName, customerMappings }),
      });
      setResult(r);
      setCsv("");
      setFileName("");
      setPreview(null);
      setCustomerMappings({});
      if (fileRef.current) fileRef.current.value = "";
      onComplete();
    } catch (e: any) {
      alert(e.message || "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function rowLabel(r: any): string {
    return r.projectName || r.fullName || r.companyName || r.label || `Row ${r.rowIndex}`;
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <div className="font-bold text-redland-charcoal">{title}</div>
        <p className="text-xs text-gray-600 mt-1">{blurb}</p>
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-1">Expected columns (flexible — case/spacing don't matter)</div>
        <div className="text-xs font-mono bg-gray-50 rounded p-2 break-all">{sampleHeaders.join(" · ")}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
          className="text-sm flex-1"
        />
        {templatePath && (
          <button onClick={downloadTemplate} className="btn-ghost text-xs">⬇ Download template</button>
        )}
      </div>

      {csv && !preview && !result && (
        <button onClick={doPreview} disabled={busy} className="btn-ghost disabled:opacity-50">
          {busy ? "Parsing…" : "Preview rows"}
        </button>
      )}

      {preview && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Stat label="Total" value={preview.totalRows} />
            <Stat label="Will update" value={preview.matched.length} accent="green" />
            <Stat label="Will create" value={preview.newRows.length} accent="gold" />
          </div>
          {preview.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded p-2">
              {preview.errors.length} row(s) had errors:{" "}
              {preview.errors.slice(0, 5).map((e: any) => `row ${e.row}: ${e.reason}`).join("; ")}
              {preview.errors.length > 5 && "…"}
            </div>
          )}
          {showUnknownLists && (preview.unknownCustomers?.length > 0 || preview.unknownEstimators?.length > 0) && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded p-2 space-y-1">
              <div className="font-bold">⚠ Heads up — these names weren't found in your existing data:</div>
              {preview.unknownCustomers?.length > 0 && (
                <div><strong>Unknown customers ({preview.unknownCustomers.length}):</strong> {preview.unknownCustomers.slice(0, 6).join(", ")}{preview.unknownCustomers.length > 6 && "…"}</div>
              )}
              {preview.unknownEstimators?.length > 0 && (
                <div><strong>Unknown estimators ({preview.unknownEstimators.length}):</strong> {preview.unknownEstimators.slice(0, 6).join(", ")}{preview.unknownEstimators.length > 6 && "…"}</div>
              )}
              <div className="text-yellow-700 text-[0.7rem]">Catch typos here before committing — otherwise duplicate records will be created.</div>
            </div>
          )}

          {preview.customerSuggestions && Object.keys(preview.customerSuggestions).length > 0 && (
            <CustomerMapper
              suggestions={preview.customerSuggestions}
              mappings={customerMappings}
              onChange={setCustomerMappings}
            />
          )}
          <div className="max-h-48 overflow-y-auto text-xs space-y-1">
            {preview.matched.slice(0, 5).map((m: any) => (
              <div key={m.rowIndex} className="text-green-700">↻ {rowLabel(m)} → matched</div>
            ))}
            {preview.newRows.slice(0, 5).map((n: any) => (
              <div key={n.rowIndex} className="text-redland-charcoal">+ {rowLabel(n)} (new)</div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={doImport} disabled={busy} className="btn-primary disabled:opacity-50">
              {busy ? "Importing…" : "Commit import"}
            </button>
            <button onClick={() => { setCsv(""); setFileName(""); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
          ✓ Done. {result.created} created, {result.updated || 0} updated, {result.skipped} skipped, {result.errors?.length || 0} errors.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "green" | "gold" }) {
  const color = accent === "green" ? "text-green-700" : accent === "gold" ? "text-redland-gold" : "text-redland-charcoal";
  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-[0.65rem] text-gray-500 uppercase font-semibold">{label}</div>
      <div className={`text-xl font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

function CustomerMapper({ suggestions, mappings, onChange }: {
  suggestions: Record<string, any>;
  mappings: Record<string, number>;
  onChange: (m: Record<string, number>) => void;
}) {
  // Three groups: matched-via-something, has-suggestions-but-no-match, totally unknown
  const entries = Object.entries(suggestions);
  const auto = entries.filter(([_, s]) => s.match);
  const fuzzy = entries.filter(([_, s]) => !s.match && s.suggestions.length > 0);
  const unknown = entries.filter(([_, s]) => !s.match && s.suggestions.length === 0);

  function pick(key: string, customerId: number | null) {
    const next = { ...mappings };
    if (customerId === null) delete next[key];
    else next[key] = customerId;
    onChange(next);
  }

  return (
    <div className="card p-3 space-y-3 border-blue-200 bg-blue-50/30">
      <div className="font-bold text-redland-charcoal text-sm">Customer matching</div>
      <p className="text-xs text-gray-600">
        {auto.length} customer name(s) auto-matched · {fuzzy.length} need your confirmation · {unknown.length} will be created fresh
      </p>

      {fuzzy.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-yellow-800">⚠ Did you mean…?</div>
          <p className="text-xs text-gray-600">When you pick a match, the original spelling becomes an alias so future imports auto-route here.</p>
          {fuzzy.map(([key, s]: [string, any]) => {
            const picked = mappings[key];
            return (
              <div key={key} className="border border-yellow-200 bg-white rounded p-2">
                <div className="text-sm">
                  <strong className="text-redland-charcoal">"{s.rawName || key}"</strong>
                  <span className="text-xs text-gray-500"> in CSV</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {s.suggestions.map((sug: any) => (
                    <button
                      key={sug.id}
                      onClick={() => pick(key, picked === sug.id ? null : sug.id)}
                      className={`text-xs px-2 py-1 rounded border ${picked === sug.id ? "bg-green-600 text-white border-green-600" : "bg-white border-gray-300 hover:border-redland-red"}`}
                      title={`Match score: ${(sug.score * 100).toFixed(0)}%`}
                    >
                      {picked === sug.id && "✓ "}{sug.customerNumber || ""} {sug.companyName} <span className="opacity-70">({(sug.score * 100).toFixed(0)}%)</span>
                    </button>
                  ))}
                  <button
                    onClick={() => pick(key, picked === -1 ? null : -1)}
                    className="text-xs px-2 py-1 rounded border bg-white border-gray-300 hover:border-redland-charcoal text-gray-700"
                  >
                    Create new
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unknown.length > 0 && (
        <div className="text-xs text-gray-600">
          <strong>Will be created as new customers ({unknown.length}):</strong>{" "}
          {unknown.slice(0, 6).map(([_, s]: [string, any]) => s.rawName).filter(Boolean).join(", ")}
          {unknown.length > 6 && "…"}
        </div>
      )}
    </div>
  );
}
