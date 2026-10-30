import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB, isDbConfigured } from "@/lib/db";
import { aiModel, isAiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  let db: { configured: boolean; connected: boolean; error?: string } = { configured: isDbConfigured(), connected: false };
  if (db.configured) {
    try {
      await connectDB();
      await mongoose.connection.db?.admin().ping();
      db.connected = true;
    } catch (e) {
      db = { ...db, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({
    db,
    ai: { configured: isAiConfigured(), model: isAiConfigured() ? aiModel() : null },
    connectUrlConfigured: Boolean(process.env.NEXT_PUBLIC_CONNECT_URL),
  });
}
