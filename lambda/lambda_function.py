#===========================
# Main Lambda function to handle HTTP API requests
#===========================

# Imports
import base64
import json
import os

from http_utils import _resp
from athena_client import validate_sql, run_athena
from openai_client import openai_plan, openai_chart_spec
from plotly_client import build_plotly_figure


def _is_debug_request(event: dict) -> bool:
    """Check if the request should return debug info."""
    headers = event.get("headers") or {}
    headers_lc = {str(k).lower(): str(v) for k, v in headers.items()}

    header_debug = headers_lc.get("x-debug", "").strip().lower() in ("1", "true", "yes", "on")
    env_debug = os.environ.get("DEBUG_RESPONSES", "false").lower() in ("1", "true", "yes")
    return header_debug or env_debug

def ask_manual_sql_mode(*, body: dict, path: str, method: str, event: dict):
    """
    Manual SQL mode handler:
      - Reads body["sql"]
      - Validates SQL
      - Runs Athena
      - Returns minimal UI payload always
      - Optionally attaches a 'debug' blob when x-debug:1 header is present
        or DEBUG_RESPONSES env var is true

    Returns: whatever _resp(status_code, payload) returns.
    """
    manual_sql = (body.get("sql") or "").strip()
    if not manual_sql:
        return _resp(400, {"error": "Missing 'sql' for manual_sql mode.", "mode": "manual_sql"})

    debug = _is_debug_request(event)

    # --- Minimal response shape for UI (always) ---
    ui = {
        "mode": "manual_sql",
        "question": None,  # keep same UI shape as openai mode
        "intent": None,
        "summary": None,
        "sql": None,
        "chart": None,
        "result": None,
    }

    # --- Full debug payload (only attached when debug is true) ---
    debug_payload = {
        "path": path,
        "method": method,
        "database": os.environ.get("ATHENA_DB"),
        "workgroup": os.environ.get("ATHENA_WORKGROUP", "primary"),
        "outputLocation": os.environ.get("ATHENA_RESULTS_S3"),
        "error_stage": None,
        "raw_sql": manual_sql,  # raw user input (useful for debugging)
    }

    sql = None
    result = None
    error_stage = None

    try:
        error_stage = "validate_sql"
        sql = validate_sql(manual_sql)
        ui["sql"] = sql

        error_stage = "athena"
        result = run_athena(sql)
        ui["result"] = result

        if debug:
            debug_payload["error_stage"] = error_stage
            ui["debug"] = debug_payload

        return _resp(200, ui)

    except Exception as e:
        ui["error"] = str(e)

        # If we validated SQL before failing, return it to UI
        if sql:
            ui["sql"] = sql
        else:
            # Optionally return raw SQL to UI on error; comment out if you dislike this
            ui["sql"] = manual_sql

        # Use 400 for validation / user mistakes, 500 for Athena/internal
        status = 500
        msg = str(e).lower()
        if "invalid sql" in msg or "missing limit" in msg or "only select" in msg:
            status = 400

        if debug:
            import traceback
            debug_payload["error_stage"] = error_stage or error_stage
            debug_payload["error"] = str(e)
            debug_payload["traceback"] = traceback.format_exc()
            debug_payload["sql_present"] = sql is not None
            ui["debug"] = debug_payload

        return _resp(status, ui)


def ask_openai_mode(*, body: dict, path: str, method: str, event: dict):
    """
    OpenAI mode handler:
      - Generates SQL + plan via OpenAI
      - Validates SQL
      - Runs Athena
      - Returns minimal UI payload always
      - Optionally attaches a 'debug' blob when DEBUG_RESPONSES=true

    Returns: whatever _resp(status_code, payload) returns.
    """
    # Extract question from body, return 400 error if missing
    question = (body.get("question") or "").strip()
    if not question:
        return _resp(400, {"error": "Missing 'question' (or provide 'sql' for manual test)."})
    
    debug = _is_debug_request(event)
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    plan = None
    sql = None
    result = None
    error_stage = None

    # --- Minimal response shape for UI (always) ---
    ui = {
        "mode": "openai",
        "model": model,
        "question": question,
        "intent": None,
        "summary": None,
        "sql": None,
        "chart": None,
        "result": None,
    }

    # --- Full debug payload (only attached when debug is true) ---
    debug_payload = {
        "path": path,
        "method": method,
        "database": os.environ.get("ATHENA_DB"),
        "workgroup": os.environ.get("ATHENA_WORKGROUP", "primary"),
        "outputLocation": os.environ.get("ATHENA_RESULTS_S3"),
        "limits": {
            "temperature": float(os.environ.get("OPENAI_TEMPERATURE", "0")),
            "max_output_tokens": int(os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", "600")),
            "max_question_chars": int(os.environ.get("MAX_QUESTION_CHARS", "1200")),
        },
        "error_stage": None,
        "raw_plan": None,
    }

    try:
        error_stage = "openai_plan"
        plan = openai_plan(question)

        ui["intent"] = plan.get("intent", "answer")
        ui["chart"] = plan.get("chart")
        ui["summary"] = plan.get("summary", "")

        if debug:
            debug_payload["raw_plan"] = plan

        error_stage = "validate_sql"
        sql = validate_sql(plan.get("sql", ""))
        ui["sql"] = sql

        error_stage = "athena"
        result = run_athena(sql)
        ui["result"] = result

        if debug:
            debug_payload["error_stage"] = error_stage
            ui["debug"] = debug_payload

        return _resp(200, ui)

    except Exception as e:
        # Always return minimal UI info on failure
        ui["error"] = str(e)

        # Preserve plan-derived fields if we got them
        if isinstance(plan, dict):
            ui["intent"] = ui["intent"] or plan.get("intent")
            ui["summary"] = ui["summary"] or plan.get("summary", "")
            if ui["chart"] is None:
                ui["chart"] = plan.get("chart")

        # If SQL was produced before failure, still return it for UI
        if sql:
            ui["sql"] = sql
        elif isinstance(plan, dict) and plan.get("sql"):
            # raw model SQL (not validated) — optional, but can be helpful
            ui["sql"] = plan.get("sql")

        # Status selection
        status = 500
        msg = str(e).lower()
        if "invalid sql" in msg or "missing limit" in msg or "only select" in msg:
            status = 400

        if debug:
            import traceback
            debug_payload["error_stage"] = error_stage
            debug_payload["error"] = str(e)
            debug_payload["traceback"] = traceback.format_exc()
            debug_payload["plan_present"] = plan is not None
            debug_payload["sql_present"] = sql is not None
            ui["debug"] = debug_payload

        return _resp(status, ui)


def ask_chart_mode(*, body: dict, path: str, method: str, event: dict):
    """
    Chart mode handler (two-step):
      1) OpenAI -> SQL plan
      2) Athena -> result
      3) OpenAI -> chart spec grounded in result columns
      4) Plotly -> figure JSON
    """
    question = (body.get("question") or "").strip()
    if not question:
        return _resp(400, {"error": "Missing 'question' for chart mode.", "mode": "chart"})

    debug = _is_debug_request(event)
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    plan = None
    sql = None
    result = None
    chart = None
    figure = None
    error_stage = None

    ui = {
        "mode": "chart",
        "model": model,
        "question": question,
        "intent": "chart",
        "summary": None,
        "sql": None,
        "chart": None,
        "figure": None,
        "result": None,
    }

    debug_payload = {
        "path": path,
        "method": method,
        "database": os.environ.get("ATHENA_DB"),
        "workgroup": os.environ.get("ATHENA_WORKGROUP", "primary"),
        "outputLocation": os.environ.get("ATHENA_RESULTS_S3"),
        "error_stage": None,
        "raw_plan": None,
        "raw_chart": None,
    }

    try:
        # 1) OpenAI -> plan (we mainly need SQL; plan may contain chart, but we’ll ground it later)
        error_stage = "openai_plan"
        plan = openai_plan(question)

        # Force chart intent here (since /chart route)
        ui["summary"] = (plan.get("summary") if isinstance(plan, dict) else "") or ""

        if debug:
            debug_payload["raw_plan"] = plan

        # 2) Validate + run Athena
        error_stage = "validate_sql"
        sql = validate_sql(plan.get("sql", "") if isinstance(plan, dict) else "")
        ui["sql"] = sql

        error_stage = "athena"
        result = run_athena(sql)
        ui["result"] = result

        # 3) OpenAI -> grounded chart spec (based on actual columns)
        error_stage = "openai_chart_spec"
        columns = result.get("columns") or []
        sample_rows = result.get("rows") or []
        raw_chart = openai_chart_spec(question=question, columns=columns, sample_rows=sample_rows)

        # Normalize into your expected shape for plotly_client
        chart = {
            "type": raw_chart.get("type"),
            "x": raw_chart.get("x"),
            "y": raw_chart.get("y"),
            "title": raw_chart.get("title"),
        }
        ui["chart"] = chart

        if debug:
            debug_payload["raw_chart"] = raw_chart

        # 4) Build Plotly figure JSON
        error_stage = "plotly"
        figure = build_plotly_figure(chart, result)
        ui["figure"] = figure

        if debug:
            debug_payload["error_stage"] = error_stage
            ui["debug"] = debug_payload

        return _resp(200, ui)

    except Exception as e:
        ui["error"] = str(e)

        if sql:
            ui["sql"] = sql
        if chart:
            ui["chart"] = chart
        if result:
            ui["result"] = result

        status = 500
        msg = str(e).lower()
        if "invalid sql" in msg or "missing limit" in msg or "only select" in msg:
            status = 400
        if "chart." in msg or "unsupported chart" in msg or "not found in athena result columns" in msg:
            status = 400

        if debug:
            import traceback
            debug_payload["error_stage"] = error_stage
            debug_payload["error"] = str(e)
            debug_payload["traceback"] = traceback.format_exc()
            ui["debug"] = debug_payload

        return _resp(status, ui)


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

        #3.1 --- Manual SQL mode (delegated to ask_manual_sql_mode)---
        manual_sql = (body.get("sql") or "").strip()
        if manual_sql:
            return ask_manual_sql_mode(body=body, path=path, method=method, event=event)


        # 3.2 --- OpenAI mode (delegated to ask_openai_mode)---
        return ask_openai_mode(body=body, path=path, method=method, event=event)


    # 4. Chart endpoint /chart (LLM-driven chart)
    if method == "POST" and path.endswith("/chart"):
        try:
            raw_body = event.get("body") or ""
            if event.get("isBase64Encoded"):
                raw_body = base64.b64decode(raw_body).decode("utf-8")
            body = json.loads(raw_body or "{}")
        except json.JSONDecodeError:
            return _resp(400, {"error": "Invalid JSON body"})

        return ask_chart_mode(body=body, path=path, method=method, event=event)

    # Fallback
    return _resp(404, {"error": f"Route not found: {method} {path}"})