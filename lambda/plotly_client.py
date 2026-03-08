# ========================
# Plotly Client to draw charts based on Openai chart specs + Athena results.
# ========================

from __future__ import annotations
from typing import Any, Dict, List


ALLOWED_TYPES = {"bar", "line", "scatter", "histogram", "box"}


def validate_chart_spec(chart: Dict[str, Any], columns: List[str]) -> Dict[str, Any]:
    """Validate + normalize chart spec from OpenAI."""
    if not isinstance(chart, dict):
        raise ValueError("chart must be an object")

    ctype = (chart.get("type") or "").strip().lower()
    if ctype not in ALLOWED_TYPES:
        raise ValueError(f"Unsupported chart.type '{ctype}'. Allowed: {sorted(ALLOWED_TYPES)}")

    x = (chart.get("x") or "").strip()
    y = (chart.get("y") or "").strip()
    title = (chart.get("title") or "").strip() or "Chart"

    if not x:
        raise ValueError("chart.x is required")
    if ctype not in {"histogram", "box"} and not y:
        raise ValueError("chart.y is required for this chart type")

    # Column allowlist check (prevents hallucinated column names)
    colset = {c for c in columns}
    if x not in colset:
        raise ValueError(f"chart.x '{x}' not found in Athena result columns")
    if y and y not in colset:
        raise ValueError(f"chart.y '{y}' not found in Athena result columns")

    return {"type": ctype, "x": x, "y": y, "title": title}


def build_plotly_figure(chart: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
    """Convert (chart spec + Athena result) to Plotly figure JSON."""
    columns = result.get("columns") or []
    rows = result.get("rows") or []

    chart = validate_chart_spec(chart, columns)

    x_key, y_key = chart["x"], chart["y"]
    ctype = chart["type"]

    # Extract series (Athena returns values as strings; frontend can coerce too)
    xs = [(r.get(x_key)) for r in rows]

    if ctype in {"histogram", "box"}:
        # One-variable charts
        trace = {"type": ctype, "x": xs if ctype == "histogram" else None, "y": xs if ctype == "box" else None}
    else:
        ys = [(r.get(y_key)) for r in rows]
        trace_type = "scatter" if ctype in {"line", "scatter"} else "bar"
        mode = "lines" if ctype == "line" else "markers" if ctype == "scatter" else None

        trace = {"type": trace_type, "x": xs, "y": ys}
        if mode:
            trace["mode"] = mode

    layout = {
        "title": chart["title"],
        "xaxis": {"title": x_key},
        "yaxis": {"title": y_key} if y_key else {},
    }

    return {"data": [trace], "layout": layout}