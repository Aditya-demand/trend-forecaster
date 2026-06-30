import type { RawPoint } from "./forecasting";

// Lightweight CSV parser that handles quoted fields and commas inside quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else if (c === "\r") {
      // ignore, handled by \n
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ParsedCsv = {
  points: RawPoint[];
  timeColumn: string;
  valueColumn: string;
  columns: string[];
};

// Parses CSV text into time/value points. Picks the first text-like column as
// the time axis and the first numeric column as the value, unless headers hint
// otherwise (date/time/month/period vs value/amount/sales/count).
export function parseDataset(text: string): ParsedCsv {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const header = rows[0].map((h) => h.trim());
  const body = rows.slice(1);

  const lower = header.map((h) => h.toLowerCase());
  const timeHints = ["date", "time", "month", "period", "year", "week", "day", "quarter"];
  const valueHints = ["value", "amount", "sales", "revenue", "count", "qty", "quantity", "total", "y", "price"];

  let timeIdx = lower.findIndex((h) => timeHints.some((k) => h.includes(k)));
  let valueIdx = lower.findIndex((h) => valueHints.some((k) => h.includes(k)));

  const numericScore = (idx: number) =>
    body.reduce((acc, r) => acc + (r[idx] !== undefined && r[idx].trim() !== "" && !Number.isNaN(Number(r[idx])) ? 1 : 0), 0);

  if (valueIdx === -1) {
    let best = -1; let bestScore = -1;
    for (let i = 0; i < header.length; i++) {
      const s = numericScore(i);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    valueIdx = best;
  }
  if (timeIdx === -1) {
    timeIdx = header.findIndex((_, i) => i !== valueIdx);
    if (timeIdx === -1) timeIdx = 0;
  }

  const points: RawPoint[] = body.map((r) => {
    const t = (r[timeIdx] ?? "").trim();
    const rawV = (r[valueIdx] ?? "").trim();
    const v = rawV === "" || Number.isNaN(Number(rawV)) ? null : Number(rawV);
    return { t, y: v };
  });

  return { points, timeColumn: header[timeIdx], valueColumn: header[valueIdx], columns: header };
}