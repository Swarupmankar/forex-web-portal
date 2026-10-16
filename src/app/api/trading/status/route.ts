import { NextResponse } from "next/server";
import { tradingStatus } from "@/lib/server/env";

// Runtime kill switch polled by the UI. This static segment takes precedence over
// the sibling [...path] catch-all, so it is never proxied to the backend.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(tradingStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
