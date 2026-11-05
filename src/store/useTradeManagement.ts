import {create} from 'zustand';
import type {Order} from '@/types/trading';
import type {OrderChanges} from '@/lib/connectedOrders';
import type {ManagementAction,ManagementResult} from '@/lib/tradeManagement';
export type ManagementSelection={key:string;generation:number;order:Order;action:ManagementAction;practice:boolean;initial?:OrderChanges;focus?:'sl'|'tp'|'entry'};
type State={selection?:ManagementSelection;results:Record<string,ManagementResult>;preview?:{id:string;changes:OrderChanges};select:(s:ManagementSelection|undefined)=>void;setPreview:(p:State['preview'])=>void;put:(r:ManagementResult)=>void;clearResult:(id:string)=>void;reset:()=>void};
export const useTradeManagement=create<State>(set=>({
  results:{},
  select:selection=>set({selection,preview:undefined}),
  setPreview:preview=>set({preview}),
  put:result=>set(state=>{
    const old=state.results[result.command.orderId];
    // Account observations can arrive before the HTTP acknowledgement.
    if(old?.key===result.key && ['complete','changed','rejected'].includes(old.status) && ['sending','submitted','checking','unconfirmed'].includes(result.status))return {};
    return {results:{...state.results,[result.command.orderId]:result}};
  }),
  clearResult:id=>set(state=>{const results={...state.results};delete results[id];return {results};}),
  reset:()=>set({selection:undefined,preview:undefined,results:{}}),
}));
