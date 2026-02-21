# ========================
# Athena Client for query executions and query result retrieval and query checking.
# ========================

# Import enn libs
import os
import time
import boto3

#Athena client for AWS
athena = boto3.client("athena")

# Very small SQL guardrails
FORBIDDEN = ("insert", "update", "delete", "drop", "alter", "create", "msck", "unload")

#
def _get_results_s3() -> str:
    """Get Athena results S3 path from env"""
    results_s3 = os.environ["ATHENA_RESULTS_S3"]

    # Ensure it ends with "/" for Athena output prefix
    if not results_s3.endswith("/"):
        results_s3 += "/"

    return results_s3


def validate_sql(sql: str) -> str:
    """Validate SQL query against simple safety rules and enforce a LIMIT.
    Returns modified SQL if valid, else raises ValueError."""
    
    # Load table and database info from env for allowlist checks
    db = os.environ["ATHENA_DB"]
    table = os.environ["ATHENA_TABLE"]

    allowed_db = db
    allowed_tables = {
        table.lower(),
        f"{db}.{table}".lower(),
    }

    # Preprocess SQL string for checks
    s = (sql or "").strip()
    lower = s.lower()

    # Basic checks on the SQL string
    if not lower.startswith("select"):
        raise ValueError("Only SELECT queries are allowed.")
    if ";" in s:
        raise ValueError("Multiple statements are not allowed.")
    if any(k in lower for k in FORBIDDEN):
        raise ValueError("Query contains forbidden keywords.")

    # Enforce a LIMIT if missing (cost control)
    if " limit " not in lower and not lower.endswith(" limit"):
        s = s.rstrip() + " LIMIT 200"
        lower = s.lower()

    # Enforce allowlisted tables only (simple string checks; not a full SQL parser)
    if f"{allowed_db.lower()}." in lower:
        if not any(t in lower for t in allowed_tables):
            raise ValueError(f"Only table '{db}.{table}' is allowed in this demo.")
    else:
        if table.lower() not in lower:
            raise ValueError(f"Only table '{table}' (or '{db}.{table}') is allowed in this demo.")
    
      # If we passed all checks, return the (possibly modified) SQL string
    return s


def run_athena(sql: str, max_wait_seconds: int = 25, max_results: int = 1000) -> dict:
    """Runs an Athena query.
    Returns first page of results as a dict with keys: queryExecutionId, columns, rows."""

    # Load db from env
    db = os.environ["ATHENA_DB"]

    # Load workgroup from env
    workgroup = os.environ.get("ATHENA_WORKGROUP", "primary")
    
    # Get results S3 path from env and ensure it ends with "/"
    results_s3 = _get_results_s3()

    # Start Athena query execution and get query execution ID
    resp = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": db},
        WorkGroup=workgroup,
        ResultConfiguration={"OutputLocation": results_s3},
    )
    qid = resp["QueryExecutionId"]

    # Poll Athena for query to check completion
    start = time.time()
    last_state = None
    while True:
        q = athena.get_query_execution(QueryExecutionId=qid)["QueryExecution"]
        st = q["Status"]["State"]
        last_state = st
        if st in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        if time.time() - start > max_wait_seconds:
            raise TimeoutError(f"Athena query timed out (qid={qid}, last_state={last_state})")
        time.sleep(0.5)

    # Check final state and raise error if not succeeded
    if st != "SUCCEEDED":
        reason = q["Status"].get("StateChangeReason", "")
        raise RuntimeError(f"Athena query {st} (qid={qid}): {reason}")

    # First page only
    res = athena.get_query_results(QueryExecutionId=qid, MaxResults=max_results)
    cols = [c["Label"] for c in res["ResultSet"]["ResultSetMetadata"]["ColumnInfo"]]

    # Process rows into list of dicts
    rows_raw = res["ResultSet"]["Rows"]
    out_rows = []
    for r in rows_raw[1:]:  # skip header
        vals = [d.get("VarCharValue") for d in r.get("Data", [])]
        out_rows.append(dict(zip(cols, vals)))

    # Return query execution ID, columns, and rows
    return {"queryExecutionId": qid, "columns": cols, "rows": out_rows}
