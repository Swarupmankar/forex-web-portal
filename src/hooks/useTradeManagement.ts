"use client";
import {useEffect,useRef} from 'react';
import {useTradeManagement,type ManagementSelection} from '@/store/useTradeManagement';
import {useAccountStore} from '@/store/useAccountStore';
import {usePracticeStore} from '@/store/usePracticeStore';
import {useOrderFlow} from '@/store/useOrderFlow';
import {useUIStore} from '@/store/useUIStore';
import {store} from '@/store';
import {tradingApi,useGetOpenOrdersQuery,useGetOrderHistoryQuery,useModifyOrderMutation,useExitOrderMutation} from '@/store/api/tradingApi';
import {useExecutionPolicy} from './useExecutionPolicy';
import {useTradingAccountId} from './useTradingAccountId';
import {executableQuote} from './useExecutableQuote';
import {ownOrders} from '@/lib/positionPnl';
import {historyRows} from '@/lib/connectedOrders';
import {managementPending,managementPolling,managementTitle,expireManagement,prepareManagement,reconcileManagement,type ManagementDraft,type ManagementResult} from '@/lib/tradeManagement';
import {useWorkspaceStore} from '@/store/useWorkspaceStore';
import {playTradeSoundOnce} from '@/lib/tradeSound';
import {classifyFailure} from '@/lib/orderOutcome';
import {errorMessage} from '@/lib/market';
import {mobileSocketService} from '@/services/mobileSocket';

/** Mounted once in the persistent ticket slot; observation continues when the editor is dismissed. */
export function useManagementTracking() {
  const selection=useTradeManagement(s=>s.selection),results=useTradeManagement(s=>s.results);
  const authenticated=useUIStore(s=>s.isAuthenticated),practice=usePracticeStore(s=>s.mode==='practice');
  const accountId=useTradingAccountId();
  const pending=Object.values(results).filter(r=>!r.practice&&managementPending(r));
  const polling=pending.some(managementPolling);
  const enabled=!practice&&authenticated&&(!!selection||pending.length>0);
  const needHistory=enabled&&(selection?.action!=='edit'||pending.some(r=>r.command.action!=='edit'));
  const orders=useGetOpenOrdersQuery(undefined,{skip:!enabled,pollingInterval:polling?2000:0,refetchOnFocus:true,refetchOnReconnect:true});
  const history=useGetOrderHistoryQuery(undefined,{skip:!needHistory,pollingInterval:polling?2000:0,refetchOnFocus:true,refetchOnReconnect:true});
  const announced=useRef(new Map<string,string>());
  useEffect(()=>{
    const currentKeys=new Set(Object.values(results).map(result=>result.key));
    for(const key of announced.current.keys())if(!currentKeys.has(key))announced.current.delete(key);
    for(const result of Object.values(results)){
      if(result.generation!==useAccountStore.getState().generation||!['complete','rejected','changed','unconfirmed'].includes(result.status)||announced.current.get(result.key)===result.status)continue;
      announced.current.set(result.key,result.status);
      if(result.status==='complete'&&!result.practice&&useWorkspaceStore.getState().tradeSounds)void playTradeSoundOnce(`management:${result.key}`,result.command.action==='close'?'closed':'updated');
      if(!result.notify)continue;
      useWorkspaceStore.getState().notify(`${managementTitle(result)} · #${result.command.orderId}${result.message?` — ${result.message}`:''}`,result.status==='complete'?'success':result.status==='unconfirmed'?'warning':'error');
    }
  },[results]);
  useEffect(()=>{
    for(const result of Object.values(results)){
      if(result.practice||result.generation!==useAccountStore.getState().generation)continue;
      const observedAt=result.command.action==='edit'?orders.fulfilledTimeStamp??0:Math.min(orders.fulfilledTimeStamp??0,history.fulfilledTimeStamp??0);
      const next=reconcileManagement(result,ownOrders([...(orders.currentData?.openOrders??[]),...(orders.currentData?.pendingOrders??[])],accountId),ownOrders(historyRows(history.currentData),accountId),observedAt);
      if(next!==result)useTradeManagement.getState().put(next);
    }
  },[results,orders.currentData,history.currentData,orders.fulfilledTimeStamp,history.fulfilledTimeStamp,accountId]);
  useEffect(()=>{
    if(!polling)return;
    const timer=setInterval(()=>{
      for(const result of Object.values(useTradeManagement.getState().results)){const next=expireManagement(result,Date.now());if(next!==result)useTradeManagement.getState().put(next);}
    },1000);
    return ()=>clearInterval(timer);
  },[polling]);
  return {orders,history,refresh:()=>{
    if(enabled)void orders.refetch();
    if(needHistory)void history.refetch();
  }};
}

export function useManagementSubmit() {
  const policy=useExecutionPolicy(),accountId=useTradingAccountId();
  const [modify]=useModifyOrderMutation(),[exit]=useExitOrderMutation();
  return async(selection:ManagementSelection,draft:ManagementDraft):Promise<string|undefined>=>{
    const flow=useOrderFlow.getState(),management=useTradeManagement.getState();
    if(flow.inFlight||flow.verifying)return 'Another request is still being confirmed.';
    if(managementPending(management.results[String(selection.order.id)]))return 'This trade has an unresolved request. Check its status before submitting again.';
    if(!policy.canManage||selection.practice!==policy.practice)return policy.reason??'Trade management is unavailable.';
    const generation=useAccountStore.getState().generation;
    if(selection.generation!==generation)return 'Account changed. Reopen the trade from the current account.';
    const paper=usePracticeStore.getState();
    const list=tradingApi.endpoints.getOpenOrders.select()(store.getState()).data;
    const current=selection.practice?paper.account.orders.find(o=>o.id===String(selection.order.id)):
      ownOrders([...(list?.openOrders??[]),...(list?.pendingOrders??[])],accountId).find(o=>String(o.id)===String(selection.order.id));
    const {command,error}=prepareManagement(selection.order,current,selection.action,draft,executableQuote(selection.order.symbol));
    if(error||!command)return error;
    const history=tradingApi.endpoints.getOrderHistory.select()(store.getState()).data;
    const result:ManagementResult={key:crypto.randomUUID(),before:current!,command,practice:selection.practice,accountId,generation,startedAt:Date.now(),notify:true,knownExits:historyRows(history).filter(o=>String(o.id)===command.orderId).map(o=>o.exitRowId!),status:'sending'};
    flow.set({inFlight:true});management.put(result);management.setPreview(undefined);
    try{
      if(selection.practice){
        const ids=new Set(paper.account.orders.map(o=>o.id));
        if(command.action==='close')paper.closeVolume(command.orderId,command.lots!);
        else if(command.action==='cancel')paper.manage(command.orderId,'cancel');
        else paper.editOrder(command.orderId,command.changes);
        const after=usePracticeStore.getState().account.orders;
        const updated=after.find(o=>o.id===command.orderId);
        const closed=after.find(o=>o.status==='CLOSED'&&(!ids.has(o.id)||o.id===command.orderId));
        management.put({...result,status:'complete',...(command.action==='close'&&{remaining:updated?.status==='OPEN'?updated.lotSize:0}),...(command.action==='close'&&closed&&{exitPrice:closed.exitPrice,pnl:closed.pnl})});
      }else{
        mobileSocketService.ensureConnected();
        if(command.action==='close')await exit({orderId:command.orderId,exitLotSize:command.lots!,idempotencyKey:result.key}).unwrap();
        else await modify({orderId:command.orderId,cancelOrder:command.action==='cancel',...command.changes,idempotencyKey:result.key}).unwrap();
        if(generation!==useAccountStore.getState().generation)return;
        management.put({...result,status:'submitted'});
        store.dispatch(tradingApi.util.invalidateTags(['Orders','Account','OrderHistory']));
      }
    }catch(error){
      if(generation!==useAccountStore.getState().generation)return;
      const unknown=!selection.practice&&classifyFailure(error)==='unknown';
      management.put({...result,status:unknown?'checking':'rejected',...(!unknown&&{message:errorMessage(error,'The request was rejected.')})});
      if(unknown)store.dispatch(tradingApi.util.invalidateTags(['Orders','Account','OrderHistory']));
    }finally{
      if(generation===useAccountStore.getState().generation)flow.set({inFlight:false});
    }
  };
}
