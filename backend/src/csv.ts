// Minimal CSV/TSV parser. Handles quoted fields, escaped quotes, CRLF/LF.
// Returns array of row-objects keyed by lowercased+trimmed header names.

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCSV(input: string, delimiter?: string): ParsedCSV {
  if (!input) return { headers: [], rows: [] };
  const trimmed = input.replace(/^﻿/, ""); // strip BOM
  const delim = delimiter || (trimmed.indexOf("\t") !== -1 && trimmed.indexOf(",") === -1 ? "\t" : ",");
  const rows: string[][] = [];
  let i = 0;
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  while (i < trimmed.length) {
    const c = trimmed[i];
    if (inQuotes) {
      if (c === '"' && trimmed[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (c === "\r" && trimmed[i + 1] === "\n") i += 2;
      else i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const lookup = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const data = rows[r];
    if (data.length === 1 && data[0].trim() === "") continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < lookup.length; c++) {
      obj[lookup[c]] = (data[c] || "").trim();
    }
    out.push(obj);
  }
  return { headers, rows: out };
}

export function parseMoney(v: string | undefined | null): bigint | null {
  if (!v) return null;
  const clean = String(v).replace(/[\$,\s]/g, "").replace(/\(([^)]+)\)/, "-$1");
  if (!clean || isNaN(parseFloat(clean))) return null;
  return BigInt(Math.round(parseFloat(clean) * 100));
}

export function parsePct(v: string | undefined | null): number | null {
  if (!v) return null;
  const clean = String(v).replace(/%/g, "").trim();
  if (!clean || isNaN(parseFloat(clean))) return null;
  return parseFloat(clean);
}

export function parseDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
