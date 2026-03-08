import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: Request) {
  const API_URL = process.env.API_URL?.replace(/\/+$/, "");
  const API_KEY = process.env.API_KEY;

  if (!API_URL) return jsonError("Missing API_URL", 500);
  if (!API_KEY) return jsonError("Missing API_KEY", 500);

  // Rate limit: make it a bit stricter if charts are heavier
  const ip = getClientIp(req);
  const retryAfter = rateLimitOrNull(`chart:${ip}`, 3, 60_000); // 3/min
  if (retryAfter) {
    return NextResponse.json(
      { error: "Too many requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let payload: any = {};
  try {
    // allow empty body too
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/chart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload ?? {}),
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