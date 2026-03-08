type Row = Record<string, unknown>;

type ApiMeta = {
  mode?: string;
  sql?: string;
  queryExecutionId?: string;
};

type Props = {
  rows: Row[] | null;
  columns: string[];
  meta: ApiMeta | null;
  loading: boolean;
  onCopySql: () => void;
  onDownloadCsv: () => void;
};

export default function ResultsPanel({
  rows,
  columns,
  meta,
  loading,
  onCopySql,
  onDownloadCsv,
}: Props) {
  return (
    <section className="border rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">Result</div>

        {rows && (
          <div className="text-xs text-gray-600">
            Rows: <span className="font-medium">{rows.length}</span> · Columns:{" "}
            <span className="font-medium">{columns.length}</span>
          </div>
        )}

        {meta?.mode && (
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            mode: {String(meta.mode)}
          </span>
        )}

        {meta?.queryExecutionId && (
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            qid: {String(meta.queryExecutionId)}
          </span>
        )}

        <div className="ml-auto flex gap-2">
          <button
            className="border rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={onCopySql}
            disabled={loading}
            title="Copy SQL to clipboard"
          >
            Copy SQL
          </button>

          <button
            className="border rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={onDownloadCsv}
            disabled={!rows || rows.length === 0}
            title="Download results as CSV"
          >
            Download CSV
          </button>
        </div>
      </div>

      {meta?.sql && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-gray-700">Show SQL (agent output)</summary>
          <pre className="mt-2 text-xs border rounded-lg bg-gray-50 p-3 whitespace-pre-wrap overflow-auto">
            {String(meta.sql)}
          </pre>
        </details>
      )}
    </section>
  );
}