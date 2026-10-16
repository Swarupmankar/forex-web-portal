"use client";
import { useEffect } from "react";
import { reportClientError } from "@/lib/clientErrors";

export default function TerminalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error, { panel: "page", digest: error.digest ?? "" }), [error]);
  return (
    <main className="app-error" role="alert">
      <h1>The terminal hit a problem</h1>
      <p>Your account, positions and orders are unaffected. Reload to continue.</p>
      <div>
        <button className="button button-primary" onClick={reset}>Try again</button>
        <button className="button button-outline" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </main>
  );
}
