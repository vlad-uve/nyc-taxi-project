type Row = Record<string, unknown>;

function isIsoDateLike(s: string) {
  return /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/.test(s);
}

function formatCell(v: unknown): string {
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

type Props = {
  rows: Row[] | null;
  columns: string[];
  totalRows: number;
  shownRows: number;
  onShowMore: () => void;
};

export default function ResultsTable({
  rows,
  columns,
  totalRows,
  shownRows,
  onShowMore,
}: Props) {
  if (!rows || rows.length === 0) return null;

  return (
    <section className="border rounded-xl overflow-hidden bg-white">
      <div className="overflow-auto max-h-[560px]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((k) => (
                <th
                  key={k}
                  className="text-left p-2 border-b sticky top-0 bg-gray-50 z-10 whitespace-nowrap"
                  title={k}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                {columns.map((k) => {
                  const raw = r[k];
                  const text = formatCell(raw);
                  const isNum = typeof raw === "number";

                  return (
                    <td
                      key={k}
                      className={`p-2 border-b align-top max-w-[360px] ${
                        isNum ? "text-right tabular-nums" : "text-left"
                      }`}
                      title={text}
                    >
                      <div className="truncate">{text}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRows > shownRows && (
        <div className="p-3 border-t bg-white flex items-center gap-2">
          <div className="text-xs text-gray-600">
            Showing <span className="font-medium">{shownRows}</span> of{" "}
            <span className="font-medium">{totalRows}</span> rows
          </div>

          <button
            className="ml-auto border rounded-lg px-3 py-1.5 text-sm"
            onClick={onShowMore}
          >
            Show more
          </button>
        </div>
      )}
    </section>
  );
}