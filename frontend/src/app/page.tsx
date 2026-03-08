"use client";

import InfoPanels from "@/components/InfoPanels";
import QueryPanel from "@/components/QueryPanel";
import ResultsPanel from "@/components/ResultsPanel";
import ResultsTable from "@/components/ResultsTable";
import PlotlyChart from "@/components/PlotlyChart";
import { useAgent } from "@/hooks/useAgent";

const APP_TITLE = "AI Analytics Agent — NYC TLC Yellow Taxi Dataset";
const APP_SUBTITLE =
  "An AI-powered analytics interface that lets users explore the NYC Taxi dataset using natural language. The system converts questions into SQL, safely executes them in Amazon Athena, and returns results as tables or Plotly charts.";
  

export default function Home() {
  const {
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
  } = useAgent();

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{APP_TITLE}</h1>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            LLM
          </span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            Text-to-SQL
          </span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            Data Engineering
          </span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            AWS
          </span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            Lambda
          </span>
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            Glue
          </span>
        </div>

        <p className="text-sm text-gray-600">{APP_SUBTITLE}</p>
      </header>

      {/* Main 2-column layout */}
      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT: everything data/query related */}
        <div className="w-full space-y-6">
          <div className="w-full">
            <QueryPanel
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              question={question}
              setQuestion={setQuestion}
              sql={sql}
              setSql={setSql}
              loading={loading}
              onAskNL={onAskNL}
              onAskChart={onAskChart}
              onRunSql={onRunSql}
              onClearSql={clearSql}
            />
          </div>

          {error && (
            <div className="w-full text-sm text-red-700 border border-red-200 bg-red-50 rounded-lg p-3 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {(meta || rows) && (
            <div className="w-full">
              <ResultsPanel
                rows={rows}
                columns={columns}
                meta={meta}
                loading={loading}
                onCopySql={onCopySql}
                onDownloadCsv={onDownloadCsv}
              />
            </div>
          )}

          {chartSpec && rows && rows.length > 0 && (
            <section className="w-full border rounded-xl bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm font-medium">Chart</div>
                <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                  Plotly spec from agent
                </span>
              </div>

              <PlotlyChart chart={chartSpec} rows={rows as any} />
            </section>
          )}

          {rows && rows.length > 0 && (
            <div className="w-full">
              <ResultsTable
                rows={visibleRows}
                columns={columns}
                totalRows={rows.length}
                shownRows={showRows}
                onShowMore={() =>
                  setShowRows((x) => Math.min(x + 200, rows.length))
                }
              />
            </div>
          )}

          {rows && rows.length === 0 && !error && (
            <div className="w-full text-sm text-gray-600">No rows returned.</div>
          )}
        </div>

        {/* RIGHT: info only */}
        <div className="w-full">
          <InfoPanels />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 text-xs text-gray-500">
        Built with Next.js + Tailwind. Server proxy:{" "}
        <span className="font-mono">/api/ask</span> &{" "}
        <span className="font-mono">/api/chart</span>.
      </footer>
    </main>
  );
}