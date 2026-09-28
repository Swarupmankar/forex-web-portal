import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";

// Liveness: the process is up and serving. Does not touch the backend.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: serverEnv().version,
      uptimeS: Math.round(process.uptime()),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
