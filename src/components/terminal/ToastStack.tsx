"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { useWorkspaceStore, type Toast } from "@/store/useWorkspaceStore";
import { TOAST_LIFETIME, visibleNotifications } from '@/lib/notifications';
import { Dialog } from './Dialog';

const ICONS = { success: Check, error: CircleAlert, warning: TriangleAlert, info: Info };

// Hidden burst messages expire too; their details remain in Recent notifications.
function ToastExpiry({ toast, paused }: { toast: Toast; paused: boolean }) {
  const dismiss = useWorkspaceStore(s => s.dismissToast);
  useEffect(() => {
    if (!toast.active || toast.sticky || paused) return;
    const timer = setTimeout(() => dismiss(toast.id), TOAST_LIFETIME);
    return () => clearTimeout(timer);
  }, [toast.id, toast.at, toast.active, toast.sticky, paused, dismiss]);
  return null;
}

export function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useWorkspaceStore(s => s.dismissToast);
  const Icon = ICONS[toast.kind];
  return <div className={`terminal-toast is-${toast.kind}`}>
    <Icon aria-hidden="true" />
    <div className="toast-copy">
      {toast.title && <strong>{toast.title}</strong>}
      <span>{toast.text}</span>
    </div>
    {toast.count > 1 && <b className="toast-count">×{toast.count}</b>}
    <button className="icon-button" aria-label={`Dismiss ${toast.title || 'message'}`} onClick={() => dismiss(toast.id)}><X aria-hidden="true" /></button>
  </div>;
}

export function NotificationButton() {
  const count = useWorkspaceStore(s => s.toasts.length);
  const alert = useWorkspaceStore(s => s.toasts.some(t => t.active && t.sticky));
  const open = useWorkspaceStore(s => s.notificationsOpen);
  return <button className="icon-button notification-button" title="Recent notifications" aria-label={`Recent notifications${count?` (${count})`:''}${alert?' · needs attention':''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => useWorkspaceStore.getState().setNotificationsOpen(true)}>
    <Bell aria-hidden="true" />{count>0&&<span className={alert?'needs-attention':''} aria-hidden="true">{count>9?'9+':count}</span>}
  </button>;
}

export function ToastStack() {
  const toasts = useWorkspaceStore(s => s.toasts);
  const open = useWorkspaceStore(s => s.notificationsOpen);
  const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[hidden,setHidden]=useState(false);
  const unseen = useRef(new Set<string>());
  const latest = toasts.at(-1), visible = visibleNotifications(toasts);
  useEffect(()=>{if(open||visible.length===0){setHovered(false);setFocused(false);}},[open,visible.length]);
  useEffect(() => {
    if (!latest) { unseen.current.clear(); document.title=document.title.replace(/^\(\d+\) /,''); return; }
    if (document.visibilityState === 'visible') return;
    unseen.current.add(latest.id);
    document.title = `(${unseen.current.size}) ${document.title.replace(/^\(\d+\) /, '')}`;
  }, [latest?.id, latest?.at]);
  useEffect(() => {
    const changed = () => {
      setHidden(document.visibilityState !== 'visible');
      if (document.visibilityState !== 'visible') return;
      unseen.current.clear(); document.title = document.title.replace(/^\(\d+\) /, '');
    };
    changed(); document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const announcement=latest?`${latest.title?`${latest.title}. `:''}${latest.text}${latest.count>1?` (${latest.count} times)`:''}`:'';
  return <>
    {toasts.filter(t=>t.active).map(toast=><ToastExpiry key={toast.id} toast={toast} paused={hovered||focused||hidden||open}/>)}
    {!open && visible.length>0 && <section className="toast-stack" aria-label="Notifications" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocused(false);}}>
      {visible.map(toast=><ToastItem key={toast.id} toast={toast}/>)}
      <button className="toast-recent" onClick={()=>{setHovered(false);setFocused(false);useWorkspaceStore.getState().setNotificationsOpen(true);}}><Bell aria-hidden="true"/>Recent notifications <span>{toasts.length}</span></button>
    </section>}
    {open&&<Dialog title="Recent notifications" className="notification-history" onClose={()=>useWorkspaceStore.getState().setNotificationsOpen(false)}>
      <div className="notification-history-heading"><span>Latest {toasts.length} · current account session</span>{toasts.length>0&&<button className="text-button" onClick={()=>useWorkspaceStore.getState().clearToasts()}>Clear notifications</button>}</div>
      {toasts.length===0?<p className="helper">Order updates and other messages will appear here.</p>:<ol className="notification-history-list">{[...toasts].reverse().map(toast=>{
        const Icon=ICONS[toast.kind];
        return <li key={toast.id} className={`is-${toast.kind}`}><Icon aria-hidden="true"/><div><strong>{toast.title||({success:'Completed',error:'Needs attention',warning:'Notice',info:'Update'}[toast.kind])}{toast.count>1?` ×${toast.count}`:''}</strong><p>{toast.text}</p><time dateTime={new Date(toast.at).toISOString()}>{new Date(toast.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></div>{toast.active&&toast.sticky&&<button className="icon-button" aria-label={`Dismiss ${toast.title||'message'}`} onClick={()=>useWorkspaceStore.getState().dismissToast(toast.id)}><X aria-hidden="true"/></button>}</li>;
      })}</ol>}
    </Dialog>}
    <div className="sr-only" aria-live="polite" aria-atomic="true">{latest?.kind!=='error'?announcement:''}</div>
    <div className="sr-only" aria-live="assertive" aria-atomic="true">{latest?.kind==='error'?announcement:''}</div>
  </>;
}
