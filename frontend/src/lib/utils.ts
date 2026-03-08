export type Row = Record<string, unknown>;

export function isIsoDateLike(s: string) {
  return /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/.test(s);
}

export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";

  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }

  if (typeof v === "boolean") return v ? "true" : "false";

  if (typeof v === "string") {
    const s = v.trim();
    if (isIsoDateLike(s)) return s.replace("T", " ").replace("Z", "");
    return v;
  }

  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function toCsv(rows: Row[], columns: string[]) {
  const esc = (x: string) => {
    const needs = /[",\n]/.test(x);
    const y = x.replaceAll('"', '""');
    return needs ? `"${y}"` : y;
  };

  const header = columns.map(esc).join(",");

  const body = rows
    .map((r) =>
      columns.map((c) => esc(formatCell(r[c]))).join(",")
    )
    .join("\n");

  return `${header}\n${body}\n`;
}

export async function copyToClipboard(text: string) {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}