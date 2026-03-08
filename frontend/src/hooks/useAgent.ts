"use client";

import { useMemo, useState } from "react";
import type { ChartSpec } from "@/components/PlotlyChart";
import { SQL_PRESETS } from "@/components/QueryPanel";
import { askApi, chartApi } from "@/lib/api";
import { copyToClipboard, toCsv, type Row } from "@/lib/utils";

type ApiMeta = {
  mode?: string;
  sql?: string;
  queryExecutionId?: string;
};

type ActiveTab = "nl" | "sql" | "chart";

function extractRows(data: any): Row[] {
  if (Array.isArray(data?.result?.rows)) return data.result.rows;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function extractMeta(data: any): ApiMeta {
  return {
    mode: data?.mode,
    sql: data?.sql,
    queryExecutionId: data?.result?.queryExecutionId,
  };
}

export function useAgent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("nl");
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState(SQL_PRESETS[0]?.value ?? "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<ApiMeta | null>(null);

  const [showRows, setShowRows] = useState(200);
  const [chartSpec, setChartSpec] = useState<ChartSpec | null>(null);

  const columns = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!rows) return null;
    return rows.slice(0, showRows);
  }, [rows, showRows]);

  function resetBeforeRequest() {
    setLoading(true);
    setError(null);
    setRows(null);
    setMeta(null);
    setShowRows(200);
    setChartSpec(null);
  }

  async function postJson(payload: unknown) {
    resetBeforeRequest();

    try {
      const data = await askApi(payload);
      setRows(extractRows(data));
      setMeta(extractMeta(data));
    } catch (e: any) {
      setError(e?.message ?? "Fetch error");
    } finally {
      setLoading(false);
    }
  }

  async function postChart(payload: unknown) {
    resetBeforeRequest();

    try {
      const data = await chartApi(payload);

      setRows(extractRows(data));
      setMeta(extractMeta(data));

      if (data?.chart?.type && data?.chart?.x) {
        setChartSpec(data.chart as ChartSpec);
      }
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

  async function onAskChart() {
    const q = question.trim();
    if (!q) {
      setError("Type a natural-language question first.");
      return;
    }

    await postChart({ question: q });
  }

  async function onRunSql() {
    const s = sql.trim();
    if (!s) {
      setError("Type a SQL query first.");
      return;
    }

    await postJson({ sql: s });
  }

  async function onCopySql() {
    const text = meta?.sql || sql;
    const ok = await copyToClipboard(String(text || ""));
    if (!ok) {
      setError("Could not copy to clipboard (browser permission).");
    }
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

  function clearSql() {
    setSql("");
  }

  return {
    activeTab,
    setActiveTab,
    question,
    setQuestion,
    sql,
    setSql,
    loading,
    error,
    rows,
    meta,
    columns,
    visibleRows,
    showRows,
    setShowRows,
    chartSpec,
    onAskNL,
    onAskChart,
    onRunSql,
    onCopySql,
    onDownloadCsv,
    clearSql,
  };
}