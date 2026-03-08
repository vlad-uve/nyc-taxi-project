"use client";

import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Row = Record<string, any>;

export type ChartSpec = {
  type: "bar" | "line" | "scatter" | "histogram" | "box";
  x: string;
  y?: string;
  title?: string;
};

function toNumber(v: any) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

export default function PlotlyChart({
  chart,
  rows,
  height = 420,
}: {
  chart: ChartSpec;
  rows: Row[];
  height?: number;
}) {
  if (!chart || !chart.x) return null;
  if (!rows || rows.length === 0) return <div className="text-sm text-gray-600">No chart data.</div>;

  const x = rows.map((r) => r?.[chart.x]);

  const isOneVar = chart.type === "histogram" || chart.type === "box";
  const y = !isOneVar && chart.y ? rows.map((r) => toNumber(r?.[chart.y!])) : undefined;

  let trace: any = {};

  if (chart.type === "bar") trace = { type: "bar", x, y };
  if (chart.type === "line") trace = { type: "scatter", mode: "lines", x, y };
  if (chart.type === "scatter") trace = { type: "scatter", mode: "markers", x, y };
  if (chart.type === "histogram") trace = { type: "histogram", x: x.map(toNumber) };
  if (chart.type === "box") trace = { type: "box", y: x.map(toNumber) };

  const layout: any = {
    title: chart.title ?? "Chart",
    height,
    margin: { l: 55, r: 20, t: 55, b: 55 },
    xaxis: { title: chart.x },
    yaxis: { title: chart.y ?? "" },
  };

  return (
    <Plot
      data={[trace]}
      layout={layout}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}