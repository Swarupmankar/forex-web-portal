"use client";
import { useState } from 'react';
import { Bell, Info, PanelLeft, PanelRight, Rows3, RotateCcw, MoreHorizontal, ArrowLeft, History } from 'lucide-react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useUIStore } from '@/store/useUIStore';
import { useTradingStatus } from '@/store/useTradingStatus';
import { usePracticeStore } from '@/store/usePracticeStore';
import { showActivity, openActivityView } from '@/lib/tradingWorkflow';
import { useTradeManagement } from '@/store/useTradeManagement';
import { managementPending } from '@/lib/tradeManagement';
import { Dialog } from './Dialog';
import { InstrumentDetails } from './InstrumentDetails';
import { ToolbarMenu } from './ToolbarMenu';
import {useTicketVisibility} from '@/hooks/useTicketVisibility';

export function WorkspaceHeading() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const symbol = useUIStore(s => s.activeSymbol);
  const practice = usePracticeStore(s => s.mode === 'practice');
  const environment = useTradingStatus(s => s.status?.env);
  const marketsOpen = useWorkspaceStore(s => s.marketsOpen);
  const {visible: ticketOpen} = useTicketVisibility();
  const density = useWorkspaceStore(s=>s.density);
  const activityExpanded = useWorkspaceStore(s => s.activityExpanded);
  const activityOnly = useWorkspaceStore(s => s.activityMaximized);
  const shownTicket = ticketOpen && !activityOnly;
  const tab = useUIStore(s => s.bottomTab);
  const pendingRequests = useTradeManagement(s => Object.values(s.results).filter(managementPending).length);
  return <>
    <div className="desktop-heading">
      <h1 className="sr-only">Trading workspace</h1>
      <div className="workspace-panel-toggles" aria-label="Workspace panels">
        {activityOnly ? <button className="button button-outline" onClick={()=>{useWorkspaceStore.getState().setActivityMaximized(false);useWorkspaceStore.getState().setPanel('chart');}}><ArrowLeft/><span>Back to terminal</span></button> : <>
        <button className="button button-outline" aria-label={`${marketsOpen ? 'Hide' : 'Show'} watchlist`} aria-expanded={marketsOpen} aria-controls="workspace-watchlist" onClick={() => useWorkspaceStore.getState().setMarketsOpen(!marketsOpen)}><PanelLeft /><span>Watchlist</span></button>
        <button className="button button-outline" aria-label={`${activityExpanded ? 'Collapse' : 'Expand'} positions and history`} aria-expanded={activityExpanded} aria-controls="workspace-activity" onClick={() => activityExpanded ? useWorkspaceStore.getState().setActivityExpanded(false) : showActivity(useUIStore.getState().bottomTab)}><Rows3 /><span>Activity</span></button>
        </>}
        {activityOnly&&<span className="focused-activity-title">{{positions:'Positions',pending:'Pending orders',history:'Trade history',alerts:'Price alerts'}[tab]}</span>}
      </div>
      <div className="desktop-heading-actions">
        <ToolbarMenu label="More options" icon={<MoreHorizontal />} className="workspace-more">
          <p className="workspace-environment">{practice ? 'Practice · simulated funds' : `Environment: ${environment || 'connected'}`}</p>
          <button onClick={()=>openActivityView('positions')}><Rows3/>Open Positions view</button>
          <button onClick={()=>openActivityView('history')}><History/>Open History view</button>
          <button onClick={()=>useWorkspaceStore.getState().setDensity(density==='compact'?'comfortable':'compact')}>{density==='compact'?'Use comfortable size':'Use compact size'}</button>
          <button onClick={() => setDetailsOpen(true)}><Info />{symbol} details</button>
          <button onClick={() => useWorkspaceStore.getState().setAlertOpen(true)}><Bell />Price alert</button>
          <button onClick={() => useWorkspaceStore.getState().resetLayout()}><RotateCcw />Reset panel sizes</button>
        </ToolbarMenu>
        <button className="button button-primary workspace-ticket-toggle" aria-label={`${shownTicket ? 'Hide' : 'Show'} order ticket${pendingRequests ? ` · ${pendingRequests} requests awaiting confirmation` : ''}`} aria-expanded={shownTicket} aria-controls="workspace-ticket" onClick={() => shownTicket ? useWorkspaceStore.getState().closeOrderTicket() : useWorkspaceStore.getState().openOrderTicket()}><PanelRight /><span>Order ticket</span>{pendingRequests > 0 && <span className="count">{pendingRequests}</span>}</button>
      </div>
    </div>
    {detailsOpen && <Dialog title={`${symbol} details`} className="instrument-spec-dialog" onClose={() => setDetailsOpen(false)}><InstrumentDetails onNavigate={() => setDetailsOpen(false)} /></Dialog>}
  </>;
}
