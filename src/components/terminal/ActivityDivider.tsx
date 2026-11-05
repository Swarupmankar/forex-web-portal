"use client";
import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { activityHeight, ACTIVITY_MIN, ACTIVITY_MAX, ACTIVITY_DEFAULT, CHART_RESERVED_SPACE } from '@/lib/workspaceLayout';

// Leave room for the chart and the divider, even after a tall dock was saved on another screen.
const CHART_SPACE = CHART_RESERVED_SPACE;
export function ActivityDivider() {
  const height = useWorkspaceStore(s => s.activityHeight);
  const setHeight = useWorkspaceStore(s => s.setActivityHeight);
  const node = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number>();
  const start = useRef<{ y: number; height: number; available?: number } | null>(null);
  useEffect(() => {
    const parent = node.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const style = getComputedStyle(parent);
      setAvailable(parent.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0'));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    measure();
    return () => observer.disconnect();
  }, []);
  const actual = activityHeight(height, available, CHART_SPACE);
  const max = activityHeight(ACTIVITY_MAX, available, CHART_SPACE);
  return <div ref={node} className="activity-divider" role="separator" aria-label="Resize positions and history panel" title="Drag to resize positions and history · double-click to reset" aria-controls="workspace-activity" aria-orientation="horizontal" aria-valuemin={ACTIVITY_MIN} aria-valuemax={max} aria-valuenow={actual} tabIndex={0}
    onDoubleClick={() => setHeight(ACTIVITY_DEFAULT)}
    onKeyDown={e => {
      const change = e.key === 'ArrowUp' ? 20 : e.key === 'ArrowDown' ? -20 : 0;
      if (change) { e.preventDefault(); setHeight(activityHeight(actual + change, available, CHART_SPACE)); }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setHeight(e.key === 'Home' ? ACTIVITY_MIN : max); }
    }}
    onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); start.current = { y: e.clientY, height: actual, available }; }}
    onPointerMove={e => { if (start.current) setHeight(activityHeight(start.current.height + start.current.y - e.clientY, start.current.available, CHART_SPACE)); }}
    onPointerUp={e => { start.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
    onPointerCancel={() => { start.current = null; }}
    onLostPointerCapture={() => { start.current = null; }}><span /></div>;
}
