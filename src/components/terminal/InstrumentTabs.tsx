"use client";
import {Plus,X} from 'lucide-react';
import {useUIStore} from '@/store/useUIStore';
import {useWorkspaceStore} from '@/store/useWorkspaceStore';
import {viewInstrument} from '@/lib/tradingWorkflow';

export function InstrumentTabs() {
  const symbols=useUIStore(s=>s.chartSymbols);
  const active=useUIStore(s=>s.activeSymbol);
  return <nav className="instrument-tabs" data-count={symbols.length} aria-label="Open charts">
    <div>{symbols.map(symbol=><span className={symbol===active?'is-active':''} key={symbol}>
      <button aria-current={symbol===active?'page':undefined} onClick={()=>viewInstrument(symbol)}>{symbol}</button>
      {symbols.length>1&&<button className="instrument-tab-close" aria-label={`Close ${symbol} chart`} onClick={()=>useUIStore.getState().closeChartSymbol(symbol)}><X/></button>}
    </span>)}</div>
    <button className="instrument-tab-add" aria-label="Open another instrument" onClick={()=>useWorkspaceStore.getState().setInstrumentPickerOpen(true)}><Plus/></button>
  </nav>;
}
