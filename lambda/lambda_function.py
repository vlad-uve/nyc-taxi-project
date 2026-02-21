#===========================
# Main Lambda function to handle HTTP API requests
#===========================

# Imports
import base64
import json
import os

from http_utils import _resp
from athena_client import validate_sql, run_athena
from openai_client import openai_plan


def lambda_handler(event, context):
    """HTTP API handler.

    Routes:
      - GET  /health   -> {ok:true}
      - POST /ask      -> either manual SQL or OpenAI planned SQL

    Manual SQL testing (without OpenAI):
      POST /ask  {"sql": "SELECT ..."}

    Normal mode (OpenAI):
      POST /ask  {"question": "..."}

    If both are provided, sql wins (explicit test intent).
    """

    # Extract HTTP method and path in a way that supports both HTTP API v2 and REST API v1 event formats
    method = (
        event.get("requestContext", {}).get("http", {}).get("method")  # HTTP API v2
        or event.get("httpMethod")                                     # REST API v1
        or ""
    )

    path = (
        event.get("rawPath")  # HTTP API v2
        or event.get("path")  # REST API v1
        or ""
    )

    # 1. CORS preflight
    if method == "OPTIONS":
        return _resp(200, {"ok": True})

    # 2. Health endpoint: DO NOT query Athena
    if method == "GET" and path.endswith("/health"):
        return _resp(200, {"ok": True})

    # 3. Main endpoint /ask
    if method == "POST" and path.endswith("/ask"):
        # Extract and parse JSON body (handle base64 if coming from API Gateway)
        try:
            raw_body = event.get("body") or ""
            if event.get("isBase64Encoded"):
                raw_body = base64.b64decode(raw_body).decode("utf-8")

            body = json.loads(raw_body or "{}")
        # If body is not valid JSON, return a 400 error with error message
        except json.JSONDecodeError:
            return _resp(400, {"error": "Invalid JSON body"})

        #3.1 --- Manual SQL mode ---
        # Extract "sql" from body, if present. If "sql" is provided
        manual_sql = (body.get("sql") or "").strip()
        if manual_sql:
            # Validate and preprocess sql querry
            # Run the query against Athena and return results
            # Return response with query, results, and metadata for debugging
            try:
                sql = validate_sql(manual_sql)
                result = run_athena(sql) 
                return _resp(200, {
                    "path": path,
                    "method": method,
                    "mode": "manual_sql",
                    "sql": sql,
                    "database": os.environ["ATHENA_DB"],
                    "workgroup": os.environ.get("ATHENA_WORKGROUP", "primary"),
                    "outputLocation": os.environ["ATHENA_RESULTS_S3"],
                    "result": result,
                })
            # Return 400 error if SQL is invalid or if Athena query fails
            except Exception as e:
                return _resp(400, {"error": str(e), "mode": "manual_sql"})

        # --- OpenAI mode ---
        # Extract question from body, return 400 error if missing
        question = (body.get("question") or "").strip()
        if not question:
            return _resp(400, {"error": "Missing 'question' (or provide 'sql' for manual test)."})

        # Call OpenAI client to get the plan (intent, SQL, summary, chart) for the question
        # Run the query against Athena and return results
        # Return response with query, results, and metadata for debugging 
        try:
            plan = openai_plan(question)
            sql = validate_sql(plan.get("sql", ""))
            result = run_athena(sql)

            return _resp(200, {
                "path": path,
                "method": method,
                "mode": "openai",
                "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                "question": question,
                "intent": plan.get("intent", "answer"),
                "sql": sql,
                "chart": plan.get("chart"),
                "summary": plan.get("summary", ""),
                "database": os.environ["ATHENA_DB"],
                "workgroup": os.environ.get("ATHENA_WORKGROUP", "primary"),
                "outputLocation": os.environ["ATHENA_RESULTS_S3"],
                "result": result,
                "limits": {
                    "temperature": float(os.environ.get("OPENAI_TEMPERATURE", "0")),
                    "max_output_tokens": int(os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", "600")),
                    "max_question_chars": int(os.environ.get("MAX_QUESTION_CHARS", "1200")),
                },
            })
        # Return 400 error if SQL is invalid or if Athena query fails
        except Exception as e:
            return _resp(500, {"error": str(e), "mode": "openai", "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini")})

    # Fallback
    return _resp(404, {"error": f"Route not found: {method} {path}"})
