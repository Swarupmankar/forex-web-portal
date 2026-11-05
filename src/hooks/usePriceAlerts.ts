'use client';
import { useEffect } from 'react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { usePriceStore } from '@/store/usePriceStore';
import { usePracticeStore } from '@/store/usePracticeStore';
import { onRawTick } from '@/services/priceSocket';
import { priceAlertReached } from '@/lib/priceAlerts';
import { playTradeSoundOnce } from '@/lib/tradeSound';
import type { PriceTick } from '@/types/trading';

// Observe every connected tick: a brief touch of the target can disappear before a UI frame.
export function usePriceAlerts() {
  const mode=usePracticeStore(s=>s.mode);
  useEffect(()=>{
    const evaluate=(quotes:Record<string,PriceTick>)=>{
      if(usePracticeStore.getState().mode!==mode)return;
      if(mode==='connected'&&usePriceStore.getState().connection!=='connected')return;
      for(const alert of useWorkspaceStore.getState().alerts){
        if(!priceAlertReached(alert,quotes[alert.symbol],mode))continue;
        // Read again before claiming so store updates / repeated ticks cannot trigger twice.
        const current=useWorkspaceStore.getState();
        if(current.alerts.find(a=>a.id===alert.id)?.triggeredAt)continue;
        current.triggerAlert(alert.id);
        const price=quotes[alert.symbol].bid.toLocaleString('en-US',{maximumFractionDigits:8});
        current.notify(`${alert.symbol} · Bid ${price} · ${alert.direction==='above'?'At or above':'At or below'} ${alert.target}`, 'info', {key:`price-alert:${alert.id}`,title:'Price alert reached',phase:'settled',sticky:true});
        if(current.tradeSounds)void playTradeSoundOnce(`price-alert:${alert.id}`,'alert');
      }
    };
    const checkCurrent=()=>evaluate(mode==='practice'?usePracticeStore.getState().quotes:usePriceStore.getState().prices);
    const unwatch=useWorkspaceStore.subscribe((next,previous)=>{if(next.alerts.some(a=>!a.triggeredAt&&a!==previous.alerts.find(old=>old.id===a.id)))checkCurrent();});
    const unprices=mode==='practice'
      ?usePracticeStore.subscribe((next,previous)=>{if(next.quotes!==previous.quotes)evaluate(next.quotes);})
      :usePriceStore.subscribe((next,previous)=>{if(next.prices!==previous.prices||next.connection!==previous.connection)evaluate(next.prices);});
    const unraw=mode==='connected'?onRawTick(tick=>evaluate({[tick.symbol]:{...tick,timestamp:tick.receivedAt}})):()=>{};
    checkCurrent();
    return()=>{unwatch();unprices();unraw();};
  },[mode]);
}
