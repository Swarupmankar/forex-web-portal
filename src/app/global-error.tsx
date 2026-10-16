"use client";
// Last-resort boundary for errors in the root layout; it renders its own document.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0c0c0c", color: "#f4f4f4", font: "15px/1.6 Inter, system-ui, sans-serif" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }} role="alert">
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>The terminal hit a problem</h1>
          <p style={{ color: "#b0b0b0", margin: "0 0 20px" }}>Your account, positions and orders are unaffected.</p>
          <button onClick={reset} style={{ background: "#b0f000", color: "#152000", border: 0, borderRadius: 999, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
