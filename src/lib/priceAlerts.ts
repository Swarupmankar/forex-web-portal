import { isQuoteExecutable } from './freshness';
import type { PriceTick } from '@/types/trading';
export type PriceAlertRule={id:string;symbol:string;target:number;direction:'above'|'below';mode?:'practice'|'connected';triggeredAt?:number};
export function priceAlertReached(alert:PriceAlertRule, quote:PriceTick|undefined, mode:'practice'|'connected', now=Date.now()) {
  if(alert.triggeredAt || (alert.mode??'connected')!==mode || !Number.isFinite(alert.target) || alert.target<=0)return false;
  if(!quote||quote.symbol!==alert.symbol||!Number.isFinite(quote.bid)||!Number.isFinite(quote.ask)||quote.bid<=0||quote.ask<quote.bid||!isQuoteExecutable(quote,now))return false;
  return alert.direction==='above'?quote.bid>=alert.target:alert.direction==='below'?quote.bid<=alert.target:false;
}
