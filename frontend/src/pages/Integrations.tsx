import React, { useEffect, useRef, useState } from "react";
import { api, fmtDateTime } from "../api";
import { useAuth } from "../auth";

type Source = "heavybid" | "sage300";

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
            source="heavybid"
            title="HCSS HeavyBid"
            blurb="Upload a HeavyBid Bid Summary CSV. Auto-matches existing opportunities by Job Number, Project Name + Customer, or Project Name. New rows create new opportunities; matched rows update bid total, due date, region, estimator, and stage."
            sampleHeaders={["Job Number", "Project Name", "Owner", "Bid Total", "Bid Due", "Estimator", "Status", "Region"]}
            onComplete={loadImports}
          />
        )}
        {canImport && (
          <ImportPanel
            source="sage300"
            title="Sage 300 CRE"
            blurb="Upload a Sage 300 Job List export. Pulls cost-to-date, billed-to-date, % complete, and computes actual margin against contract — surfaces on Backlog + Opportunity detail."
            sampleHeaders={["Job", "Job Name", "Customer", "Contract Amount", "Cost to Date", "Billed to Date", "Percent Complete", "Status"]}
            onComplete={loadImports}
          />
        )}
      </div>

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

function ImportPanel({ source, title, blurb, sampleHeaders, onComplete }: {
  source: Source;
  title: string;
  blurb: string;
  sampleHeaders: string[];
  onComplete: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
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

  async function doPreview() {
    if (!csv) return;
    setBusy(true);
    try {
      const r = await api(`/api/integrations/${source}/preview`, { method: "POST", body: JSON.stringify({ csv }) });
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
      const r = await api<any>(`/api/integrations/${source}/import`, {
        method: "POST",
        body: JSON.stringify({ csv, fileName }),
      });
      setResult(r);
      setCsv("");
      setFileName("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      onComplete();
    } catch (e: any) {
      alert(e.message || "Import failed");
    } finally {
      setBusy(false);
    }
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

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="text-sm"
      />

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
              {preview.errors.slice(0, 3).map((e: any) => `row ${e.row}: ${e.reason}`).join("; ")}
              {preview.errors.length > 3 && "…"}
            </div>
          )}
          <div className="max-h-48 overflow-y-auto text-xs space-y-1">
            {preview.matched.slice(0, 5).map((m: any) => (
              <div key={m.rowIndex} className="text-green-700">↻ {m.projectName} → matched #{m.matchedOpportunityId}</div>
            ))}
            {preview.newRows.slice(0, 5).map((n: any) => (
              <div key={n.rowIndex} className="text-redland-charcoal">+ {n.projectName} (new)</div>
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
          ✓ Done. {result.created} created, {result.updated} updated, {result.skipped} skipped, {result.errors?.length || 0} errors.
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
