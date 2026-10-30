import { NextResponse } from "next/server";
import { DbNotConfiguredError } from "./db";
import { AiNotConfiguredError } from "./ai";
import { ForbiddenError, UnauthorizedError } from "./persona";

/** Consistent JSON error responses with a `code` the UI can show config help for. */
export function apiError(e: unknown) {
  if (e instanceof DbNotConfiguredError)
    return NextResponse.json({ error: e.message, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  if (e instanceof AiNotConfiguredError)
    return NextResponse.json({ error: e.message, code: "AI_NOT_CONFIGURED" }, { status: 503 });
  if (e instanceof UnauthorizedError)
    return NextResponse.json({ error: e.message, code: "UNAUTHORIZED" }, { status: 401 });
  if (e instanceof ForbiddenError)
    return NextResponse.json({ error: e.message, code: "FORBIDDEN" }, { status: 403 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api]", msg);
  const isDbConn = /ECONNREFUSED|querySrv|ServerSelection|Could not connect to any servers|authentication failed|bad auth/i.test(msg);
  return NextResponse.json(
    { error: isDbConn ? `Could not connect to MongoDB: ${msg}` : msg, code: isDbConn ? "DB_CONNECTION" : "ERROR" },
    { status: isDbConn ? 503 : 500 }
  );
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg, code: "BAD_REQUEST" }, { status: 400 });
}

export function conflict(msg: string) {
  return NextResponse.json({ error: msg, code: "CONFLICT" }, { status: 409 });
}

export function notFound(msg = "Not found") {
  return NextResponse.json({ error: msg, code: "NOT_FOUND" }, { status: 404 });
}

export const isDupKey = (e: unknown) => (e as { code?: number })?.code === 11000;

export const cleanList = (v: unknown, max = 15, len = 60) =>
  [...new Set((Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((s) => String(s).trim().slice(0, len)).filter(Boolean))].slice(0, max);
