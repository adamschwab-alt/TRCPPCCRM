import ExcelJS from "exceljs";
import { Response } from "express";

const HEADER_FILL = "FF8B1A1A"; // Redland red
const HEADER_FONT = "FFFFFFFF";

interface Col {
  header: string;
  key: string;
  width?: number;
  format?: "money" | "date" | "datetime" | "pct";
}

export async function streamWorkbook(
  res: Response,
  filenameStem: string,
  sheets: { name: string; cols: Col[]; rows: any[] }[]
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Redland CRM";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.cols.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
    ws.getRow(1).font = { bold: true, color: { argb: HEADER_FONT } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    ws.getRow(1).alignment = { vertical: "middle" };
    for (const row of s.rows) {
      const out: any = {};
      for (const c of s.cols) {
        let v = row[c.key];
        if (c.format === "money" && v != null) v = typeof v === "bigint" ? Number(v) / 100 : Number(v) / 100;
        else if (c.format === "date" && v) v = new Date(v);
        else if (c.format === "datetime" && v) v = new Date(v);
        else if (c.format === "pct" && v != null) v = Number(v) / 100;
        out[c.key] = v;
      }
      ws.addRow(out);
    }
    // Apply formatting
    s.cols.forEach((c, idx) => {
      const col = ws.getColumn(idx + 1);
      if (c.format === "money") col.numFmt = '"$"#,##0.00';
      else if (c.format === "pct") col.numFmt = "0.0%";
      else if (c.format === "date") col.numFmt = "yyyy-mm-dd";
      else if (c.format === "datetime") col.numFmt = "yyyy-mm-dd hh:mm";
    });
  }
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameStem}-${date}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

export function streamCSV(res: Response, filenameStem: string, headers: string[], rows: any[][]) {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameStem}-${date}.csv"`);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  res.write(headers.map(esc).join(",") + "\n");
  for (const r of rows) res.write(r.map(esc).join(",") + "\n");
  res.end();
}
