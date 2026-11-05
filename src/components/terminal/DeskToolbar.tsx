"use client";
import { PanelLeft, Plus, RotateCcw, ArrowLeft, Expand } from 'lucide-react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useUIStore } from '@/store/useUIStore';
import { useAccountStore } from '@/store/useAccountStore';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useTradingStatus } from '@/store/useTradingStatus';
import { composeOrder } from '@/lib/tradingWorkflow';

export function DeskToolbar() {
  const w = useWorkspaceStore();
  const tab = useUIStore(s => s.bottomTab);
  const account = useAccountStore(s => s.accounts.find(a => a.id === s.activeId));
  const practice = usePracticeStore(s => s.mode === 'practice');
  const status = useTradingStatus(s => s.status);
  const heading = w.activityMaximized ? ({positions:'Open positions',pending:'Pending orders',history:'Trade history',alerts:'Price alerts'}[tab]) : 'Trading workspace';
  return <div className="desk-toolbar">
    <div className="desk-title">{w.activityMaximized && <button className="icon-button" aria-label="Back to trading workspace" onClick={() => {w.setActivityMaximized(false); w.setPanel('chart');}}><ArrowLeft /></button>}<h1>{heading}</h1><span>{practice ? 'Practice account' : account?.nickname || account?.username || 'Your account'}</span></div>
    <div className="desk-tools">
      {status?.env && status.env !== 'production' && <span className="desk-environment" title={`Build ${status.version || 'dev'}`}>{status.env === 'staging' ? 'Staging' : 'Development'}</span>}
      {!w.activityMaximized && <>
        <button className="desk-tool" aria-pressed={w.marketsOpen} onClick={() => w.setMarketsOpen(!w.marketsOpen)} title="Show or hide watchlist"><PanelLeft /><span>Watchlist</span></button>
        {!w.focusChart && <select className="desk-size-select" aria-label="Activity panel size" value={[180,250,380].includes(w.activityHeight)?w.activityHeight:'custom'} onChange={e=>{w.setActivityExpanded(true);w.setActivityHeight(Number(e.target.value));}}><option value="180">Compact</option><option value="250">Standard</option><option value="380">Tall activity</option><option value="custom" disabled>Custom size</option></select>}
        <button className="icon-button" aria-label={w.focusChart ? 'Leave chart focus' : 'Focus chart'} onClick={() => w.setFocus(!w.focusChart)}><Expand /></button>
      </>}
      <button className="button button-primary desk-new-order" onClick={()=>composeOrder(useUIStore.getState().activeSymbol,useUIStore.getState().selectedOrderSide)}><Plus/>New order</button>
      <button className="icon-button" aria-label="Reset workspace layout" title="Reset workspace layout" onClick={w.resetLayout}><RotateCcw /></button>
    </div>
  </div>;
}
