#==============================
# Open AI API client for generating SQL plans from natural language questions.
#==============================

# Import modules
import base64
import json
import os
import urllib.request
import urllib.error
import boto3

from semantic_layer import load_semantic_layer

# AWS Secrets Manager client for fetching OpenAI API key
secretsmanager = boto3.client("secretsmanager")

# Cache OpenAI key across warm Lambda invocations to avoid repeated Secrets Manager calls
_OPENAI_KEY_CACHE = None


def _get_openai_key() -> str:
    """Fetch OpenAI key from Secrets Manager (cached for warm invocations).
    Raises ValueError if the key is missing or invalid.
    Returns the OpenAI API key as a string.
    
    Supports only:
      - SecretString == {"OPEN_AI_KEY":"sk-..."}  (key/value JSON)
    """

    # Check cache first
    global _OPENAI_KEY_CACHE
    if _OPENAI_KEY_CACHE:
        return _OPENAI_KEY_CACHE

    # Fetch secret id from Secrets Manager, raise error if not set or invalid
    secret_id = os.environ.get("OPENAI_SECRET_ID", "").strip()
    if not secret_id:
        raise ValueError("Missing OPENAI_SECRET_ID environment variable.")
    
    # Fetch the secret value from AWS Secrets Manager
    resp = secretsmanager.get_secret_value(SecretId=secret_id)

    # Extract json with the OpenAI API key from the secret value, with basic validation
    secret_str = (resp.get("SecretString") or "").strip()
    if not secret_str:
        raise ValueError("SecretString is empty or missing in Secrets Manager secret.")

    # Ensure secret is valid JSON and is stored as JSON key/value pairs
    try:
        data = json.loads(secret_str)
    except json.JSONDecodeError:
        raise ValueError("SecretString is not valid JSON. Expected JSON with OPEN_AI_KEY field.")

    # Extract key
    key = (data.get("OPEN_AI_KEY") or data.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise ValueError("Secret JSON missing OPEN_AI_KEY (or OPENAI_API_KEY).")

    # Sanity check: OpenAI API keys typically start with "sk-"
    if not key.startswith("sk-"):
        raise ValueError("SecretString does not look like an OpenAI API key (expected to start with 'sk-').")

    # Cache the key for future invocations
    _OPENAI_KEY_CACHE = key

    # Return the OpenAI API key
    return key   


def _openai_extract_text(responses_payload: dict) -> str:
    """Extract concatenated text from OpenAI Responses API payload."""
    text_out = ""
    for item in responses_payload.get("output", []) or []:
        for c in item.get("content", []) or []:
            if c.get("type") == "output_text" and "text" in c:
                text_out += c["text"]
    return text_out.strip()


def openai_plan(question: str) -> dict:
    """Calls OpenAI Responses API to return a strict JSON plan (intent/sql/chart/summary) for questions only"""

    # Lambda level guardrails for openai mo
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    temperature = float(os.environ.get("OPENAI_TEMPERATURE", "0"))
    max_output_tokens = int(os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", "600"))
    max_question_chars = int(os.environ.get("MAX_QUESTION_CHARS", "1200"))

    # Keep SQL generation deterministic-ish for demo
    temp = max(0.0, min(0.2, temperature))
    max_out = max(64, min(1200, max_output_tokens))

    # Required DB/table (used in prompt constraints)
    db = os.environ["ATHENA_DB"]
    table = os.environ["ATHENA_TABLE"]

    # Load semantic layer and cap its size
    semantic = load_semantic_layer()
    schema_hint = json.dumps(semantic, ensure_ascii=False)
    if len(schema_hint) > 12000:
        schema_hint = schema_hint[:12000]

    # Prompting schema for chat gpt to ensure deterministic output format!!!

    required_json_schema = f"""
Return ONLY valid JSON in this exact shape:

{{
\"intent\": \"answer\" | \"chart\",
\"sql\": \"SELECT ...\",
\"summary\": \"string\",
\"chart\": {{
    \"type\": \"bar\"|\"line\"|\"scatter\"|\"histogram\"|\"box\",
    \"x\": \"column_name\",
    \"y\": \"column_name\",
    \"title\": \"string\"
}}
}}

Rules:
- Output JSON ONLY (no markdown).
- SQL must be a SINGLE Athena/Trino SELECT statement.
- Use only database: {db}
- Use only table: {db}.{table}
- Maximum limit is LIMIT 50 if limit -> always enforece LIMIT 50 if not specified.
- Prefer partition filters on year/month when possible.
- If the user asks for a plot/chart/graph -> intent MUST be "chart".
- If intent is "answer", omit the "chart" key entirely.
- If you compute a field with "AS alias", DO NOT GROUP BY or ORDER BY the alias. Use GROUP BY 1 / ORDER BY 1 (or repeat the full expression).
""".strip()

    # Truncate user questions if exceeding max chars
    q = (question or "").strip()
    if len(q) > max_question_chars:
        q = q[:max_question_chars]

    # Final prompt to OpenAI with schema, semantic hints, and user question
    user_prompt = f"""
{required_json_schema}

Context (semantic hints):
{schema_hint}

User question:
{q}
""".strip()

    # Get OpenAI API key 
    api_key = _get_openai_key()

    # Payload for OpenAI Responses API
    payload = {
        "model": model,
        "temperature": temp,
        "max_output_tokens": max_out,
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_text", "text": user_prompt}],
            }
        ],
    }

    # Make the HTTP request to OpenAI Responses API with error handling
    req = urllib.request.Request(
        url="https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    # Handle HTTP errors and providing informative error messages
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8")
            resp = json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTPError {e.code}: {err_body}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"OpenAI URLError: {e}")

    # Extract text output from OpenAI response and validate it's not empty
    text_out = _openai_extract_text(resp)
    if not text_out:
        raise ValueError(f"OpenAI returned no text output. Raw: {json.dumps(resp)[:2000]}")

    # Attempt to parse the text output as JSON and validate it has the required structure
    try:
        plan = json.loads(text_out)
    except json.JSONDecodeError:
        raise ValueError(f"Model did not return valid JSON. Raw output:\n{text_out}")

    # Return json plan (intent, sql, summary, chart) for downstream processing
    return plan


def openai_chart_spec(*, question: str, columns: list[str], sample_rows: list[dict], max_rows: int = 25) -> dict:
    """
    Ask OpenAI for a chart spec ONLY, grounded in actual Athena result columns.
    Returns dict: {"type":..., "x":..., "y":..., "title":...}
    """
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    temperature = float(os.environ.get("OPENAI_TEMPERATURE", "0"))
    max_output_tokens = int(os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", "600"))

    temp = max(0.0, min(0.2, temperature))
    max_out = max(64, min(800, max_output_tokens))  # chart spec is small

    # Cap sample rows (don’t send too much)
    rows = (sample_rows or [])[: max(0, min(max_rows, 50))]

    required_json_schema = """
Return ONLY valid JSON in this exact shape:

{
  "type": "bar"|"line"|"scatter"|"histogram"|"box",
  "x": "column_name",
  "y": "column_name",
  "title": "string"
}

Rules:
- Output JSON ONLY (no markdown).
- Use ONLY the provided columns (do not invent names).
- If type is histogram or box: y may be omitted or set to "" (one-variable chart).
- Prefer readable titles.
""".strip()

    user_prompt = f"""
{required_json_schema}

User question:
{(question or "").strip()}

Available columns:
{json.dumps(columns, ensure_ascii=False)}

Sample rows (string values):
{json.dumps(rows, ensure_ascii=False)}
""".strip()

    api_key = _get_openai_key()

    payload = {
        "model": model,
        "temperature": temp,
        "max_output_tokens": max_out,
        "input": [
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]}
        ],
    }

    req = urllib.request.Request(
        url="https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8")
            resp = json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTPError {e.code}: {err_body}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"OpenAI URLError: {e}")

    text_out = _openai_extract_text(resp)
    if not text_out:
        raise ValueError(f"OpenAI returned no text output. Raw: {json.dumps(resp)[:2000]}")

    try:
        chart = json.loads(text_out)
    except json.JSONDecodeError:
        raise ValueError(f"Model did not return valid JSON. Raw output:\n{text_out}")

    return chart