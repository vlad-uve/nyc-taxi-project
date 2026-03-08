"use client";

import { useMemo, useRef, useState } from "react";
import PlotlyChart, { type ChartSpec } from "@/components/PlotlyChart";

type Row = Record<string, unknown>;

type ApiMeta = {
  mode?: string;
  sql?: string;
  queryExecutionId?: string;
};

const APP_TITLE = "AI Analytics Agent — NYC TLC Yellow Taxi";
const APP_SUBTITLE =
  "Ask questions in natural language, inspect generated SQL, execute safely in Athena, and optionally render charts.";

const CURATED_TABLE = "nyc_taxi_curated.curated_yellow_tripdata";

// Agent-flavored NL presets (mix of trends, ranking, segmentation, and chartable outputs)
const NL_PRESETS: { label: string; value: string }[] = [
  { label: "Monthly avg trip distance (2022)", value: "Average trip distance per month in 2022" },
  { label: "Trips by weekday", value: "How many trips happen on each weekday in 2022?" },
  { label: "Trips by hour (2022)", value: "How many trips happen by pickup hour in 2022?" },
  { label: "Top 10 pickup zones", value: "Top 10 pickup zones by trip count in 2022" },
  { label: "Avg fare by distance bucket", value: "Average fare by trip distance bucket (0-1, 1-2, 2-3, ... ) in 2022" },
  { label: "Tip rate by month", value: "For 2022, show average tip amount per month and total trips" },
];

// SQL presets remain SELECT-only and encourage partitions + LIMIT
const SQL_PRESETS: { label: string; value: string }[] = [
  {
    label: "Row count (fast check)",
    value: `SELECT count(*) AS cnt
FROM ${CURATED_TABLE}
LIMIT 10`,
  },
  {
    label: "Monthly avg distance (2022)",
    value: `SELECT
  year,
  month,
  avg(trip_distance) AS avg_trip_distance
FROM ${CURATED_TABLE}
WHERE year = 2022
GROUP BY 1,2
ORDER BY 1,2
LIMIT 50`,
  },
  {
    label: "Top pickup zones (by trips)",
    value: `SELECT
  pulocationid,
  count(*) AS trips
FROM ${CURATED_TABLE}
WHERE year = 2022
GROUP BY 1
ORDER BY trips DESC
LIMIT 10`,
  },
  {
    label: "Trips by hour (2022)",
    value: `SELECT
  hour(tpep_pickup_datetime) AS pickup_hour,
  count(*) AS trips
FROM ${CURATED_TABLE}
WHERE year = 2022
GROUP BY 1
ORDER BY 1
LIMIT 24`,
  },
  {
    label: "Avg total amount by month (2022)",
    value: `SELECT
  year,
  month,
  avg(total_amount) AS avg_total_amount
FROM ${CURATED_TABLE}
WHERE year = 2022
GROUP BY 1,2
ORDER BY 1,2
LIMIT 50`,
  },
];

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

function toCsv(rows: Row[], columns: string[]) {
  const esc = (x: string) => {
    const needs = /[",\n]/.test(x);
    const y = x.replaceAll('"', '""');
    return needs ? `"${y}"` : y;
  };

  const header = columns.map(esc).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(formatCell(r[c]))).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"nl" | "sql" | "chart">("nl");

  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState(SQL_PRESETS[0].value);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<ApiMeta | null>(null);

  const [showRows, setShowRows] = useState(200);
  const [chartSpec, setChartSpec] = useState<ChartSpec | null>(null);

  const sqlRef = useRef<HTMLTextAreaElement | null>(null);
  const nlRef = useRef<HTMLInputElement | null>(null);
  const chartRef = useRef<HTMLInputElement | null>(null);

  const columns = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!rows) return null;
    return rows.slice(0, showRows);
  }, [rows, showRows]);

  async function postJson(payload: any) {
    setLoading(true);
    setError(null);
    setRows(null);
    setMeta(null);
    setShowRows(200);
    setChartSpec(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

      const data = JSON.parse(text);

      const outRows: Row[] =
        Array.isArray(data?.result?.rows) ? data.result.rows : Array.isArray(data?.rows) ? data.rows : [];

      setRows(outRows);
      setMeta({
        mode: data?.mode,
        sql: data?.sql,
        queryExecutionId: data?.result?.queryExecutionId,
      });
    } catch (e: any) {
      setError(e?.message ?? "Fetch error");
    } finally {
      setLoading(false);
    }
  }

  async function postChart(payload: any) {
    setLoading(true);
    setError(null);
    setRows(null);
    setMeta(null);
    setShowRows(200);
    setChartSpec(null);

    try {
      const res = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

      const data = JSON.parse(text);

      const outRows: Row[] =
        Array.isArray(data?.result?.rows) ? data.result.rows : Array.isArray(data?.rows) ? data.rows : [];

      setRows(outRows);

      if (data?.chart?.type && data?.chart?.x) {
        setChartSpec(data.chart as ChartSpec);
      }

      setMeta({
        mode: data?.mode,
        sql: data?.sql,
        queryExecutionId: data?.result?.queryExecutionId,
      });
    } catch (e: any) {
      setError(e?.message ?? "Fetch error");
    } finally {
      setLoading(false);
    }
  }

  async function onAskNL() {
    const q = question.trim();
    if (!q) {
      setError("Type a natural-language question first.");
      nlRef.current?.focus();
      return;
    }
    await postJson({ question: q });
  }

  async function onAskChart() {
    const q = question.trim();
    if (!q) {
      setError("Type a natural-language question first.");
      chartRef.current?.focus();
      return;
    }
    await postChart({ question: q });
  }

  async function onRunSql() {
    const s = sql.trim();
    if (!s) {
      setError("Type a SQL query first.");
      sqlRef.current?.focus();
      return;
    }
    await postJson({ sql: s });
  }

  async function onCopySql() {
    const text = meta?.sql || sql;
    const ok = await copyToClipboard(String(text || ""));
    if (!ok) setError("Could not copy to clipboard (browser permission).");
  }

  function onDownloadCsv() {
    if (!rows || rows.length === 0 || columns.length === 0) return;
    const csv = toCsv(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "query_result.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{APP_TITLE}</h1>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">Text-to-SQL</span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">Athena Tool Use</span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">Plotly Charts</span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">Audit: Copy SQL</span>
        </div>
        <p className="text-sm text-gray-600">{APP_SUBTITLE}</p>
      </div>

      {/* About + Instructions */}
      <div className="mt-5 grid gap-3">
        <details className="border rounded-lg p-4 bg-white">
          <summary className="cursor-pointer font-medium">What the agent does</summary>
          <div className="mt-3 text-sm text-gray-700 leading-6">
            <p>
              This is an <span className="font-semibold">AI Analytics Agent</span> that can:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                Convert <span className="font-medium">natural-language questions</span> into <span className="font-medium">safe SQL</span>
              </li>
              <li>Execute queries in Athena and return tabular results</li>
              <li>Expose the generated SQL for transparency (Copy/Show SQL)</li>
              <li>For chart requests, emit a Plotly chart specification and render it automatically</li>
            </ul>

            <div className="mt-3 border rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-700">Agent trace (conceptual)</div>
              <ol className="mt-2 text-xs text-gray-600 list-decimal pl-5">
                <li>Interpret intent (metrics, grouping, time scope)</li>
                <li>Plan a cost-aware query (prefer partitions: year/month, enforce small outputs)</li>
                <li>Execute tool call (Athena)</li>
                <li>Return results + generated SQL (and chart spec for visualization)</li>
              </ol>
            </div>
          </div>
        </details>

        <details className="border rounded-lg p-4 bg-white">
          <summary className="cursor-pointer font-medium">About the lakehouse (S3 → Glue → Spark → Curated → Athena)</summary>
          <div className="mt-3 text-sm text-gray-700 leading-6">
            <p>
              Data is organized in a simple lakehouse-style pipeline:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <span className="font-medium">Raw zone (S3)</span>: monthly Parquet files (append-only ingestion)
              </li>
              <li>
                <span className="font-medium">Glue Data Catalog</span>: tables/crawlers make datasets discoverable for Athena
              </li>
              <li>
                <span className="font-medium">PySpark curation</span>: type cleanup, derived columns, and partition keys
              </li>
              <li>
                <span className="font-medium">Curated zone (S3)</span>: analytics-ready Parquet partitioned by{" "}
                <span className="font-mono">year</span>/<span className="font-mono">month</span>
              </li>
              <li>
                <span className="font-medium">Athena</span>: serverless SQL engine queried by the agent
              </li>
            </ul>

            <p className="mt-3">
              Current curated fact table: <span className="font-mono">{CURATED_TABLE}</span> (one row per trip).
            </p>
          </div>
        </details>

        <details className="border rounded-lg p-4 bg-white">
          <summary className="cursor-pointer font-medium">Dataset fields (examples)</summary>
          <div className="mt-3 text-sm text-gray-700 leading-6">
            <p>
              Common columns in Yellow Taxi trip records include:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <span className="font-mono">tpep_pickup_datetime</span>, <span className="font-mono">tpep_dropoff_datetime</span>
              </li>
              <li>
                <span className="font-mono">trip_distance</span>, <span className="font-mono">passenger_count</span>
              </li>
              <li>
                <span className="font-mono">PULocationID</span>, <span className="font-mono">DOLocationID</span>
              </li>
              <li>
                <span className="font-mono">payment_type</span>, <span className="font-mono">RateCodeID</span>
              </li>
              <li>
                <span className="font-mono">fare_amount</span>, <span className="font-mono">tip_amount</span>,{" "}
                <span className="font-mono">tolls_amount</span>, <span className="font-mono">total_amount</span>
              </li>
            </ul>

            <p className="mt-3 text-xs text-gray-500">
              Tip: for cost and speed, filter by <span className="font-mono">year</span>/<span className="font-mono">month</span> partitions and use LIMIT.
            </p>
          </div>
        </details>

        <details className="border rounded-lg p-4 bg-white">
          <summary className="cursor-pointer font-medium">How to use (NLQ vs SQL vs Charts)</summary>
          <div className="mt-3 text-sm text-gray-700 leading-6">
            <ol className="list-decimal pl-5">
              <li>
                <span className="font-medium">Natural Language → Query</span>: the agent generates SQL and runs Athena.
              </li>
              <li>
                <span className="font-medium">Manual SQL</span>: you provide SELECT-only SQL (recommended: partitions + LIMIT).
              </li>
              <li>
                <span className="font-medium">Natural Language → Draw Chart</span>: the agent generates SQL + a Plotly chart spec.
              </li>
            </ol>
            <p className="mt-2 text-xs text-gray-500">
              Security note: the browser calls <span className="font-mono">/api/ask</span> and <span className="font-mono">/api/chart</span> via a server proxy (no API keys exposed client-side).
            </p>
          </div>
        </details>
      </div>

      {/* Input Panel */}
      <section className="mt-6 border rounded-xl bg-white p-4">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              activeTab === "nl" ? "bg-black text-white border-black" : "bg-white text-gray-800"
            }`}
            onClick={() => setActiveTab("nl")}
            disabled={loading}
          >
            <div className="leading-tight">
              <div>Natural Language</div>
              <div className="text-xs opacity-80">Agent → SQL → Athena</div>
            </div>
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              activeTab === "sql" ? "bg-black text-white border-black" : "bg-white text-gray-800"
            }`}
            onClick={() => setActiveTab("sql")}
            disabled={loading}
          >
            <div className="leading-tight">
              <div>Manual SQL</div>
              <div className="text-xs opacity-80">Power-user mode</div>
            </div>
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              activeTab === "chart" ? "bg-black text-white border-black" : "bg-white text-gray-800"
            }`}
            onClick={() => setActiveTab("chart")}
            disabled={loading}
          >
            <div className="leading-tight">
              <div>Natural Language</div>
              <div className="text-xs opacity-80">Agent → Chart Spec</div>
            </div>
          </button>

          <div className="ml-auto text-xs text-gray-500">{loading ? "Running…" : "Ready"}</div>
        </div>

        {/* NL Tab */}
        {activeTab === "nl" && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {NL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="text-xs px-2.5 py-1.5 border rounded-full hover:bg-gray-50"
                  onClick={() => {
                    setQuestion(p.value);
                    nlRef.current?.focus();
                  }}
                  disabled={loading}
                  title={p.value}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                ref={nlRef}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder='e.g. "Average trip distance per month in 2022"'
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onAskNL();
                  }
                }}
              />
              <button
                className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
                onClick={onAskNL}
                disabled={loading}
              >
                Ask
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Agent behavior: generates SQL, runs Athena, returns rows + SQL for audit. For best results, include year/month and request aggregates.
            </p>
          </div>
        )}

        {/* SQL Tab */}
        {activeTab === "sql" && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {SQL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="text-xs px-2.5 py-1.5 border rounded-full hover:bg-gray-50"
                  onClick={() => {
                    setSql(p.value);
                    sqlRef.current?.focus();
                  }}
                  disabled={loading}
                  title={p.label}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <textarea
                ref={sqlRef}
                className="border rounded-lg px-3 py-2 w-full font-mono text-sm min-h-[140px]"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                spellCheck={false}
              />

              <div className="mt-2 flex gap-2">
                <button
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
                  onClick={onRunSql}
                  disabled={loading}
                >
                  Run SQL
                </button>
                <button
                  className="border rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                  onClick={() => {
                    setSql("");
                    sqlRef.current?.focus();
                  }}
                  disabled={loading}
                >
                  Clear
                </button>

                <div className="ml-auto text-xs text-gray-500 flex items-center">
                  Tip: SELECT-only • prefer partitions (year/month) • always LIMIT
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chart Tab */}
        {activeTab === "chart" && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {NL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="text-xs px-2.5 py-1.5 border rounded-full hover:bg-gray-50"
                  onClick={() => {
                    setQuestion(p.value);
                    chartRef.current?.focus();
                  }}
                  disabled={loading}
                  title={p.value}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                ref={chartRef}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder='e.g. "Show monthly avg trip distance in 2022 as a line chart"'
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onAskChart();
                  }
                }}
              />
              <button
                className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
                onClick={onAskChart}
                disabled={loading}
              >
                Draw
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Agent behavior: generates SQL + a Plotly chart spec, runs Athena, and plots the returned rows.
            </p>
          </div>
        )}
      </section>

      {/* Errors */}
      {error && (
        <div className="mt-6 text-sm text-red-700 border border-red-200 bg-red-50 rounded-lg p-3 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Meta + Actions */}
      {(meta || rows) && (
        <section className="mt-6 border rounded-xl bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">Result</div>

            {rows && (
              <div className="text-xs text-gray-600">
                Rows: <span className="font-medium">{rows.length}</span> · Columns:{" "}
                <span className="font-medium">{columns.length}</span>
              </div>
            )}

            {meta?.mode && (
              <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">mode: {String(meta.mode)}</span>
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
      )}

      {/* Chart */}
      {chartSpec && rows && rows.length > 0 && (
        <section className="mt-6 border rounded-xl bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm font-medium">Chart</div>
            <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">Plotly spec from agent</span>
          </div>
          <PlotlyChart chart={chartSpec} rows={rows as any} />
        </section>
      )}

      {/* Results Table */}
      {rows && rows.length > 0 && (
        <section className="mt-6 border rounded-xl overflow-hidden bg-white">
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
                {visibleRows!.map((r, i) => (
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

          {rows.length > showRows && (
            <div className="p-3 border-t bg-white flex items-center gap-2">
              <div className="text-xs text-gray-600">
                Showing <span className="font-medium">{showRows}</span> of{" "}
                <span className="font-medium">{rows.length}</span> rows
              </div>
              <button
                className="ml-auto border rounded-lg px-3 py-1.5 text-sm"
                onClick={() => setShowRows((x) => Math.min(x + 200, rows.length))}
              >
                Show more
              </button>
            </div>
          )}
        </section>
      )}

      {rows && rows.length === 0 && !error && (
        <div className="mt-6 text-sm text-gray-600">No rows returned.</div>
      )}

      {/* Footer */}
      <footer className="mt-10 text-xs text-gray-500">
        Built with Next.js + Tailwind. Server proxy: <span className="font-mono">/api/ask</span> &{" "}
        <span className="font-mono">/api/chart</span>.
      </footer>
    </main>
  );
}