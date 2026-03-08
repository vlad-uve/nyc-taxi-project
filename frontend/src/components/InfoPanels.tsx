import { datasetInfo } from "@/lib/datasetInfo";
import DatasetPreview from "@/components/DatasetPreview";

const CURATED_TABLE = "nyc_taxi_curated.curated_yellow_tripdata";

export default function InfoPanels() {
  return (
    <div className="grid gap-3">
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
            Security note: the browser calls <span className="font-mono">/api/ask</span> and{" "}
            <span className="font-mono">/api/chart</span> via a server proxy (no API keys exposed client-side).
          </p>
        </div>
      </details>

      <details className="border rounded-lg p-4 bg-white">
        <summary className="cursor-pointer font-medium">What the agent does</summary>
        <div className="mt-3 text-sm text-gray-700 leading-6">
          <p>
            This is an <span className="font-semibold">AI Analytics Agent</span> that can:
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Convert <span className="font-medium">natural-language questions</span> into{" "}
              <span className="font-medium">safe SQL</span>
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
        <summary className="cursor-pointer font-medium">{datasetInfo.title}</summary>

        <div className="mt-3 text-sm text-gray-700 leading-6">
          <p>{datasetInfo.intro}</p>

          <div className="mt-4">
            <div className="text-sm font-medium text-gray-900">
              Sample rows from the dataset
            </div>

            <p className="text-xs text-gray-500">
              Showing a small preview of the table (first 10 rows).
            </p>

            <DatasetPreview />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {datasetInfo.sections.map((section) => (
              <div key={section.title} className="border rounded-lg bg-gray-50 p-3">
                <h4 className="font-medium text-gray-900">{section.title}</h4>
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 border rounded-lg bg-blue-50 p-3">
            <div className="text-sm font-medium text-gray-900">Example questions this dataset can answer:</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
              {datasetInfo.exampleQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-xs text-gray-500">{datasetInfo.tip}</p>
        </div>
      </details>

      <details className="border rounded-lg p-4 bg-white">
        <summary className="cursor-pointer font-medium">
          About the lakehouse (S3 → Glue → Spark → Curated → Athena)
        </summary>
        <div className="mt-3 text-sm text-gray-700 leading-6">
          <p>Data is organized in a simple lakehouse-style pipeline:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <span className="font-medium">Raw zone (S3)</span>: monthly Parquet files (append-only ingestion)
            </li>
            <li>
              <span className="font-medium">Glue Data Catalog</span>: tables/crawlers make datasets discoverable for
              Athena
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
      

    </div>
  );
}