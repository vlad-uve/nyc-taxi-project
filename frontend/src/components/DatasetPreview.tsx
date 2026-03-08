"use client";

import { useEffect, useState } from "react";

type Row = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((v) => v.trim());
}

function parseCsv(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    rows.push(row);
  }

  return rows;
}

export default function DatasetPreview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreview() {
      try {
        const res = await fetch("/data/sample_data.csv", { cache: "force-cache" });
        if (!res.ok) {
          throw new Error(`Could not load sample_data.csv (${res.status})`);
        }

        const text = await res.text();
        const parsedRows = parseCsv(text);

        setRows(parsedRows);

        if (parsedRows.length > 0) {
          setColumns(Object.keys(parsedRows[0]));
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load dataset preview");
      } finally {
        setLoading(false);
      }
    }

    loadPreview();
  }, []);

  if (loading) {
    return <div className="mt-3 text-xs text-gray-500">Loading sample rows…</div>;
  }

  if (error) {
    return <div className="mt-3 text-xs text-red-600">{error}</div>;
  }

  if (rows.length === 0) {
    return <div className="mt-3 text-xs text-gray-500">No sample rows found.</div>;
  }

return (
  <div className="mt-4 w-full max-w-full min-w-0">
    <div className="w-full max-w-[450px] min-w-0 rounded-lg border bg-white overflow-hidden">
      <div className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto max-h-[200px]">
        <div className="inline-block min-w-full align-top">
          <table className="text-xs">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="sticky top-0 bg-gray-50 text-left px-3 py-2 border-b whitespace-nowrap"
                    title={column}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="px-3 py-2 border-b whitespace-nowrap"
                      title={String(row[column] ?? "")}
                    >
                      <div className="min-w-[120px]">
                        {String(row[column] ?? "")}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);
}