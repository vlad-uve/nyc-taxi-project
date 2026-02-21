import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Simple in-memory rate limiting.
 * This is best-effort in serverless (multiple instances won’t share state),
 * but it still helps reduce accidental abuse. Your real protection should be
 * API Gateway usage plan throttles + quotas.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}

function rateLimitOrNull(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (b.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return retryAfterSec;
  }

  b.count += 1;
  return null;
}

// --- SQL guardrails ---

function stripSqlComments(sql: string) {
  // Removes simple SQL comments so keyword checks are less trivial to bypass.
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function isSelectOnly(sql: string) {
  const s = stripSqlComments(sql).toLowerCase();
  // Allow WITH ... SELECT ... queries as well.
  return s.startsWith("select") || s.startsWith("with");
}

function containsBlockedKeywords(sql: string) {
  // Blocks common DDL/DML patterns. This isn’t a full SQL parser,
  // but it catches the obvious cases.
  const s = stripSqlComments(sql).toLowerCase();
  const blocked = [
    "insert ",
    "update ",
    "delete ",
    "drop ",
    "alter ",
    "create ",
    "truncate ",
    "grant ",
    "revoke ",
    "call ",
    "merge ",
    "msck ",
    "repair ",
    "vacuum ",
  ];
  return blocked.some((k) => s.includes(k));
}

function getLimitValue(sql: string): number | null {
  const s = stripSqlComments(sql);
  const matches = [...s.matchAll(/\blimit\s+(\d+)\b/gi)];
  if (matches.length === 0) return null;

  const last = matches[matches.length - 1];
  const n = Number(last[1]);
  return Number.isFinite(n) ? n : null;
}

function enforceLimit(sql: string, maxLimit: number, defaultLimit: number) {
  const clean = sql.trim().replace(/;+\s*$/, ""); // drop trailing semicolons
  const current = getLimitValue(clean);

  if (current === null) {
    return `${clean}\nLIMIT ${defaultLimit}`;
  }

  if (current > maxLimit) {
    // Replace only the last LIMIT occurrence.
    return clean.replace(/\blimit\s+\d+\b(?![\s\S]*\blimit\s+\d+\b)/i, `LIMIT ${maxLimit}`);
  }

  return clean;
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: Request) {
  const API_URL = process.env.API_URL?.replace(/\/+$/, "");
  const API_KEY = process.env.API_KEY;

  if (!API_URL) return jsonError("Missing API_URL", 500);
  if (!API_KEY) return jsonError("Missing API_KEY", 500);

  // Rate limit: adjust if you want it stricter/looser
  const ip = getClientIp(req);
  const retryAfter = rateLimitOrNull(`ask:${ip}`, 5, 60_000); // 5 requests per minute per IP (best-effort)
  if (retryAfter) {
    return NextResponse.json(
      { error: "Too many requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const question = typeof payload?.question === "string" ? payload.question.trim() : "";
  const sqlRaw = typeof payload?.sql === "string" ? payload.sql.trim() : "";

  const hasQ = question.length > 0;
  const hasSql = sqlRaw.length > 0;

  if ((hasQ && hasSql) || (!hasQ && !hasSql)) {
    return jsonError('Provide exactly one of: {"question": "..."} OR {"sql": "..."}', 400);
  }

  // Input size caps (your requested constraints)
  if (hasQ && question.length > 1200) {
    return jsonError("Question too long (max 1200 characters).", 400);
  }
  if (hasSql && sqlRaw.length > 1000) {
    return jsonError("SQL too long (max 1000 characters).", 400);
  }

  // SQL validation + LIMIT enforcement
  let sql = sqlRaw;
  if (hasSql) {
    if (!isSelectOnly(sql)) return jsonError("Only SELECT queries are allowed.", 400);
    if (containsBlockedKeywords(sql)) return jsonError("Query contains blocked keywords (DDL/DML).", 400);

    const MAX_LIMIT = 200;     // your cap
    const DEFAULT_LIMIT = 50;  // reasonable default for a demo UI
    sql = enforceLimit(sql, MAX_LIMIT, DEFAULT_LIMIT);
  }

  const forwarded = hasSql ? { sql } : { question };

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(forwarded),
    });
  } catch (e: any) {
    return jsonError("Upstream fetch failed (API unreachable).", 502, {
      detail: e?.message ?? String(e),
    });
  }

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}