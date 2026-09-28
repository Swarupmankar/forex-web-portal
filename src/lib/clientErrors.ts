// Client-side error reporting hook. Logs with context today; point REPORT_URL at a collector
// (Sentry, an /api/telemetry route) to ship errors. Never include tokens, balances or order data.
const seen = new Set<string>();
export function reportClientError(error: unknown, context: Record<string, string> = {}) {
  const e = error instanceof Error ? error : new Error(String(error));
  const key = `${context.panel ?? ""}:${e.message}`;
  if (seen.has(key)) return;
  seen.add(key);
  console.error("[terminal]", { ...context, message: e.message, stack: e.stack?.split("\n").slice(0, 5).join("\n") });
}
