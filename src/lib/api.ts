import { NextResponse } from "next/server";
import { DbNotConfiguredError } from "./db";
import { AiNotConfiguredError } from "./ai";

/** Consistent JSON error responses with a `code` the UI can show config help for. */
export function apiError(e: unknown) {
  if (e instanceof DbNotConfiguredError)
    return NextResponse.json({ error: e.message, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  if (e instanceof AiNotConfiguredError)
    return NextResponse.json({ error: e.message, code: "AI_NOT_CONFIGURED" }, { status: 503 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api]", msg);
  const isDbConn = /ECONNREFUSED|querySrv|ServerSelection|authentication failed|bad auth/i.test(msg);
  return NextResponse.json(
    { error: isDbConn ? `Could not connect to MongoDB: ${msg}` : msg, code: isDbConn ? "DB_CONNECTION" : "ERROR" },
    { status: isDbConn ? 503 : 500 }
  );
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg, code: "BAD_REQUEST" }, { status: 400 });
}
