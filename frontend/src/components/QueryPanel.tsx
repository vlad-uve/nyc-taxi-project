type ActiveTab = "nl" | "sql" | "chart";

const CURATED_TABLE = "nyc_taxi_curated.curated_yellow_tripdata";

const NL_PRESETS: { label: string; value: string }[] = [
  { label: "Monthly avg trip distance (2022)", value: "Average trip distance per month in 2022" },
  { label: "Trips by weekday", value: "How many trips happen on each weekday in 2022?" },
  { label: "Trips by hour (2022)", value: "How many trips happen by pickup hour in 2022?" },
  { label: "Top 10 pickup zones", value: "Top 10 pickup zones by trip count in 2022" },
  { label: "Tip rate by month", value: "For 2022, show average tip amount per month and total trips" },
];

export const SQL_PRESETS: { label: string; value: string }[] = [
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
WHERE year = '2022'
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
WHERE year = '2022'
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
WHERE year = '2022'
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
WHERE year = '2022'
GROUP BY 1,2
ORDER BY 1,2
LIMIT 50`,
  },
];

type Props = {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  question: string;
  setQuestion: (value: string) => void;
  sql: string;
  setSql: (value: string) => void;
  loading: boolean;
  onAskNL: () => void;
  onAskChart: () => void;
  onRunSql: () => void;
  onClearSql: () => void;
};

export default function QueryPanel({
  activeTab,
  setActiveTab,
  question,
  setQuestion,
  sql,
  setSql,
  loading,
  onAskNL,
  onAskChart,
  onRunSql,
  onClearSql,
}: Props) {
  return (
    <section className="border rounded-xl bg-white p-4">
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

      {activeTab === "nl" && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {NL_PRESETS.map((p) => (
              <button
                key={p.label}
                className="text-xs px-2.5 py-1.5 border rounded-full hover:bg-gray-50"
                onClick={() => setQuestion(p.value)}
                disabled={loading}
                title={p.value}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
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

      {activeTab === "sql" && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {SQL_PRESETS.map((p) => (
              <button
                key={p.label}
                className="text-xs px-2.5 py-1.5 border rounded-full hover:bg-gray-50"
                onClick={() => setSql(p.value)}
                disabled={loading}
                title={p.label}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <textarea
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
                onClick={onClearSql}
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

      {activeTab === "chart" && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {NL_PRESETS.map((p) => (
              <button
                key={p.label}
                className="text-xs px-2.5 py-1.5 border rounded-full hover:bg-gray-50"
                onClick={() => setQuestion(p.value)}
                disabled={loading}
                title={p.value}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
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
  );
}