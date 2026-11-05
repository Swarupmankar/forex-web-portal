'use client';
import {useRef, type ReactNode} from 'react';

// A disclosure, rather than a menu role: native Tab/Enter behavior works for its buttons.
export function ToolbarMenu({label, icon, children, className = ''}: {label: string; icon: ReactNode; children: ReactNode; className?: string}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return <details ref={ref} className={`toolbar-menu ${className}`}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false; }}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }
    }}>
    <summary aria-label={label} title={label}>{icon}<span>{label}</span></summary>
    <div className="toolbar-menu-content" onClick={event => {
      if ((event.target as Element).closest('button') && ref.current) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    }}>{children}</div>
  </details>;
}
