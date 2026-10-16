"use client";
import { useEffect, useRef, useState } from 'react';
import { GripVertical, X, ArrowUp, ArrowDown, ScanLine } from 'lucide-react';
import type { ChartEngine } from './useChartEngine';
import { chartDragCoordinate, chartPrice } from '@/lib/chartInteraction';
import { formatPrice, instrument } from '@/lib/market';

/** Draft only: moving this handle never submits or modifies an order. */
export function ChartPendingEntry({engine,price,symbol,onChange,onCancel}:{engine:ChartEngine|null;price:number;symbol:string;onChange:(p:number)=>void;onCancel:()=>void}) {
  const [geometry,setGeometry]=useState({y:0,width:0,height:0});
  const [dragging,setDragging]=useState(false);
  const latest=useRef(price);latest.current=price;
  const drag=useRef<{start:number;anchor:number;original:number;renderedHeight:number}|null>(null);
  useEffect(()=>{
    if(!engine?.alive()) return;
    const update=()=>{const y=engine.series.priceToCoordinate(latest.current); const next={y:Number(y),width:engine.chart.timeScale().width(),height:engine.chart.paneSize().height};if(y!==null) setGeometry(old=>old.y===next.y&&old.width===next.width&&old.height===next.height?old:next);};
    update();const off=engine.subscribe(update);return()=>{off();engine.freeze(false);};
  },[engine]);
  useEffect(()=>{engine?.changed();},[price,engine]);
  function cancelDrag(){if(drag.current)onChange(drag.current.original);drag.current=null;setDragging(false);engine?.freeze(false);}
  useEffect(()=>{const cancel=()=>cancelDrag();window.addEventListener('blur',cancel);return()=>window.removeEventListener('blur',cancel);},[engine,onChange]);
  if(!geometry.height)return null;
  const offscreen=geometry.y<32 ? 'above' : geometry.y>geometry.height-18 ? 'below' : null;
  const y=Math.round(Math.max(48,Math.min(geometry.height-20,geometry.y)));
  return <div className={`chart-pending-handle ${dragging?'is-dragging':''}`} style={{top:y-15,left:12}}>
    <button aria-label="Adjust pending draft entry" title="Drag to change entry; arrow keys fine-tune; Escape cancels the drag" onPointerDown={e=>{if(e.button!==0||!engine||offscreen)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={start:e.clientY,anchor:geometry.y,original:price,renderedHeight:e.currentTarget.closest('.interactive-chart-plot')!.getBoundingClientRect().height * geometry.height / e.currentTarget.closest('.interactive-chart-plot')!.clientHeight};setDragging(true);engine.freeze(true);}}
      onPointerMove={e=>{const d=drag.current;if(!d||!engine)return;const y=chartDragCoordinate(d.anchor,e.clientY-d.start,geometry.height,d.renderedHeight);const raw=y===null?null:engine.series.coordinateToPrice(y);const p=raw===null?null:chartPrice(Number(raw),instrument(symbol).digits??5);if(p!==null)onChange(p);}}
      onPointerUp={e=>{drag.current=null;setDragging(false);engine?.freeze(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={cancelDrag} onLostPointerCapture={()=>{if(drag.current)cancelDrag();}}
      onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(drag.current)cancelDrag();else onCancel();}if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const step=10**-(instrument(symbol).digits??5)*(e.shiftKey?10:1);const p=chartPrice(price+(e.key==='ArrowUp'?step:-step),instrument(symbol).digits??5);if(p!==null)onChange(p);}}}>
      {offscreen ? offscreen==='above' ? <ArrowUp/> : <ArrowDown/> : <GripVertical/>}<span>{offscreen ? 'Draft off-screen' : 'Draft entry'}</span><b>{formatPrice(price,symbol)}</b>
    </button>{offscreen && <button aria-label="Fit pending draft price" onClick={()=>engine?.fitLevels([price])}><ScanLine/></button>}<button aria-label="Remove pending draft" onClick={onCancel}><X/></button>
  </div>;
}
