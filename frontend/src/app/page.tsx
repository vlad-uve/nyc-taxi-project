"use client";

import { useMemo, useState } from "react";

type Row = Record<string, any>;

function normalizeApiBase(raw?: string | null): { base: string | null; warn?: string } {
  if (!raw) return { base: null };

  // Trim + remove whitespace/newlines
  let u = raw.trim();

  // Remove trailing slashes
  u = u.replace(/\/+$/, "");

  // Common misconfig: user pastes full endpoint ending with /ask or /ask/
  if (u.toLowerCase().endsWith("/ask")) {
    u = u.slice(0, -4); // remove "/ask"
    u = u.replace(/\/+$/, "");
    return {
      base: u,
      warn:
        "NEXT_PUBLIC_API_URL ended with /ask. I normalized it to the stage base (…/prod). Please set NEXT_PUBLIC_API_URL to the stage base URL (without /ask).",
    };
  }

  return { base: u };
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState(
    "SELECT count(*) AS cnt FROM nyc_taxi_curated.curated_yellow_tripdata LIMIT 10"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<any>(null);

  const rawApiBase = process.env.NEXT_PUBLIC_API_URL;

  const { apiBase, apiWarn, askUrl } = useMemo(() => {
    const norm = normalizeApiBase(rawApiBase);
    const base = norm.base;
    return {
      apiBase: base,
      apiWarn: norm.warn,
      askUrl: base ? `${base}/ask` : null,
    };
  }, [rawApiBase]);

  async function postJson(payload: any) {
    if (!askUrl) {
      setError(
        "Missing NEXT_PUBLIC_API_URL. Set it to your API stage base like https://<id>.execute-api.<region>.amazonaws.com/prod (no /ask)."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setRows(null);
    setMeta(null);

    try {
      const res = await fetch(askUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // If CORS is wrong, fetch will throw before this line.
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = JSON.parse(text);

      // Your Lambda returns { result: { rows: [...] } }
      const outRows: Row[] =
        Array.isArray(data?.result?.rows)
          ? data.result.rows
          : Array.isArray(data?.rows)
          ? data.rows
          : [];

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

  async function onAskNL() {
    const q = question.trim();
    if (!q) {
      setError("Type a natural-language question first.");
      return;
    }
    await postJson({ question: q });
  }

  async function onRunSql() {
    const s = sql.trim();
    if (!s) {
      setError("Type a SQL query first.");
      return;
    }
    await postJson({ sql: s });
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">NYC Taxi — Demo</h1>

      <div className="mt-2 text-sm text-gray-600">
        <div>
          API: {apiBase ? apiBase : <span className="text-red-600">NEXT_PUBLIC_API_URL not set</span>}
        </div>
        {apiWarn && (
          <div className="mt-2 text-xs text-amber-800 border border-amber-200 bg-amber-50 rounded p-2">
            {apiWarn}
          </div>
        )}
      </div>

      {/* Natural language */}
      <section className="mt-6">
        <h2 className="text-lg font-medium">Natural language</h2>
        <div className="mt-2 flex gap-2">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder='e.g. "Average trip distance per month in 2022"'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            onClick={onAskNL}
            disabled={loading}
          >
            {loading ? "Running..." : "Ask (NL)"}
          </button>
        </div>
      </section>

      {/* Manual SQL */}
      <section className="mt-6">
        <h2 className="text-lg font-medium">Manual SQL (direct)</h2>
        <div className="mt-2 flex gap-2">
          <input
            className="border rounded px-3 py-2 w-full font-mono text-sm"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
            onClick={onRunSql}
            disabled={loading}
          >
            {loading ? "Running..." : "Run SQL"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tip: Your Lambda enforces SELECT-only and adds LIMIT if missing.
        </p>
      </section>

      {/* Errors */}
      {error && (
        <div className="mt-6 text-sm text-red-700 border border-red-200 bg-red-50 rounded p-3 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Meta */}
      {meta && (
        <div className="mt-6 text-xs text-gray-700 border rounded p-3 bg-gray-50">
          <div>
            <b>mode:</b> {String(meta.mode)}
          </div>
          {meta.queryExecutionId && (
            <div>
              <b>qid:</b> {String(meta.queryExecutionId)}
            </div>
          )}
          {meta.sql && (
            <div className="mt-2">
              <b>sql:</b>
              <pre className="mt-1 whitespace-pre-wrap">{String(meta.sql)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {rows && rows.length > 0 && (
        <div className="mt-6 overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {Object.keys(rows[0]).map((k) => (
                  <th key={k} className="text-left p-2 border-b">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  {Object.keys(rows[0]).map((k) => (
                    <td key={k} className="p-2 border-b align-top">
                      {String(r[k] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length === 0 && !error && (
        <div className="mt-6 text-sm text-gray-600">No rows returned.</div>
      )}
    </main>
  );
}
