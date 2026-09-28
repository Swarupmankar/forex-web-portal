"use client";
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { useWorkspaceStore, type Toast } from "@/store/useWorkspaceStore";

const LIFETIME_MS = 6000;
const ICONS = { success: Check, error: CircleAlert, warning: TriangleAlert, info: Info };

function ToastItem({ toast, paused }: { toast: Toast; paused: boolean }) {
  const dismiss = useWorkspaceStore((s) => s.dismissToast);
  useEffect(() => {
    if (toast.sticky || paused) return;
    // Restarts when the same message repeats (toast.at changes), so a fresh repeat is visible for the full time.
    const t = setTimeout(() => dismiss(toast.id), LIFETIME_MS);
    return () => clearTimeout(t);
  }, [toast.id, toast.at, toast.sticky, paused, dismiss]);
  const Icon = ICONS[toast.kind];
  return (
    <div className={`terminal-toast is-${toast.kind}`}>
      <Icon />
      <span>{toast.text}</span>
      {toast.count > 1 && <b className="toast-count">×{toast.count}</b>}
      <button className="icon-button" aria-label="Dismiss message" onClick={() => dismiss(toast.id)}>
        <X />
      </button>
    </div>
  );
}

export function ToastStack() {
  const toasts = useWorkspaceStore((s) => s.toasts);
  const [paused, setPaused] = useState(false);
  const unseen = useRef(0);
  const latest = toasts.at(-1);
  // While the tab is hidden, count new messages in the title so fills and stops aren't missed.
  useEffect(() => {
    if (!latest || document.visibilityState === "visible") return;
    unseen.current += 1;
    document.title = `(${unseen.current}) ${document.title.replace(/^\(\d+\) /, "")}`;
  }, [latest?.id, latest?.at]);
  useEffect(() => {
    const reset = () => {
      if (document.visibilityState !== "visible") return;
      unseen.current = 0;
      document.title = document.title.replace(/^\(\d+\) /, "");
    };
    document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, []);
  return (
    <>
      <div className="toast-stack" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {toasts.map((t) => <ToastItem key={t.id} toast={t} paused={paused} />)}
      </div>
      {/* Always mounted so screen readers announce every new message, not only the first. */}
      <div className="sr-only" aria-live="polite">{latest && latest.kind !== "error" ? `${latest.text}${latest.count > 1 ? ` (${latest.count} times)` : ""}` : ""}</div>
      <div className="sr-only" aria-live="assertive">{latest?.kind === "error" ? latest.text : ""}</div>
    </>
  );
}
