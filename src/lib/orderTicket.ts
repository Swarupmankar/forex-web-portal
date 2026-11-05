import type { TradeRequest } from './contracts';

export type TicketDraft = {
  activeSymbol: string;
  orderMode: 'MARKET' | 'PENDING';
  pendingOrderType: 'LIMIT' | 'STOP';
  volumeInput: string;
  pendingEntry: string;
  enableTPSL: boolean;
  stopLoss: string;
  takeProfit: string;
};

// Keep the user's execution type fixed when a quote moves or a chart line is dragged.
export function ticketRequest(draft: TicketDraft, side: 'BUY' | 'SELL'): TradeRequest {
  return {
    symbol:draft.activeSymbol,
    orderType:side,
    executionType:draft.orderMode==='MARKET'?'MARKET':draft.pendingOrderType,
    lotSize:Number(draft.volumeInput),
    ...(draft.orderMode==='PENDING' && {limitPrice:Number(draft.pendingEntry)}),
    ...(draft.enableTPSL && draft.stopLoss.trim() && {sl:Number(draft.stopLoss)}),
    ...(draft.enableTPSL && draft.takeProfit.trim() && {tp:Number(draft.takeProfit)}),
  };
}

export function pendingEntryRule(side: 'BUY'|'SELL', type: 'LIMIT'|'STOP') {
  const below = (side==='BUY') === (type==='LIMIT');
  return {
    sideName:side==='BUY'?'Buy':'Sell',
    quoteName:side==='BUY'?'Ask':'Bid',
    direction:below?'below':'above',
    movement:below?'falls to':'rises to',
  };
}

// A draft suggestion on the valid side of the quote; it never submits an order.
export function pendingPriceSuggestion(side:'BUY'|'SELL', type:'LIMIT'|'STOP', quote:{bid:number;ask:number}|undefined, digits:number) {
  if (!quote || !(quote.bid>0) || quote.ask<quote.bid || !Number.isFinite(quote.ask) || !Number.isInteger(digits) || digits<0 || digits>10) return undefined;
  const reference=side==='BUY'?quote.ask:quote.bid, scale=10**digits;
  const below=(side==='BUY')===(type==='LIMIT');
  const price=(below?Math.floor(reference*scale)-1:Math.ceil(reference*scale)+1)/scale;
  return price>0&&Number.isFinite(price)?price:undefined;
}
