"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  className = '',
  restoreFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  // Where focus goes on close if the element that opened the dialog no longer exists (e.g. a closed row).
  restoreFocus?: () => HTMLElement | null | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const restoreRef = useRef(restoreFocus);
  restoreRef.current = restoreFocus;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const node = ref.current;
    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
        ) || [],
      ).filter((e) => e.getClientRects().length);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const els = focusable(),
          first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      // Wait a frame so the closed row has left the DOM before choosing a fallback.
      requestAnimationFrame(() => {
        if (before?.isConnected) before.focus();
        else restoreRef.current?.()?.focus();
      });
    };
  }, []);
  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`terminal-dialog ${wide ? "is-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
