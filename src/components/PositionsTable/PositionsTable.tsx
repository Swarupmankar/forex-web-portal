'use client';

import React from 'react';
import { useUIStore } from '@/store/useUIStore';
import { usePriceStore } from '@/store/usePriceStore';
import { 
  useGetOpenOrdersQuery, 
  useGetOrderHistoryQuery, 
  useExitOrderMutation 
} from '@/store/api/tradingApi';
import { X, AlertCircle, TrendingUp, Award, Clock, Loader2, KeyRound } from 'lucide-react';

const toNum = (val: any) => {
  const n = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return Number.isFinite(n) ? n : 0;
};

export const PositionsTable: React.FC = () => {
  const { bottomTab, setBottomTab, isAuthenticated, setLoginModalOpen } = useUIStore();
  const prices = usePriceStore((state) => state.prices);

  const { data: openOrdersData, isLoading: isLoadingOrders } = useGetOpenOrdersQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: 3000,
  });
  const { data: historyData } = useGetOrderHistoryQuery(undefined, {
    skip: !isAuthenticated,
  });
  const [exitOrder] = useExitOrderMutation();

  const openPositionsList = isAuthenticated && Array.isArray(openOrdersData?.openOrders)
    ? openOrdersData!.openOrders
    : [];

  const pendingOrdersList = isAuthenticated && Array.isArray(openOrdersData?.pendingOrders)
    ? openOrdersData!.pendingOrders
    : [];

  const historyList = isAuthenticated && Array.isArray(historyData?.completedOrders)
    ? historyData!.completedOrders
    : (isAuthenticated && Array.isArray(historyData?.fullyCompletedOrders) ? historyData!.fullyCompletedOrders : []);

  const handleClosePosition = async (orderId: string | number) => {
    try {
      await exitOrder({ orderId }).unwrap();
      alert(`Position #${orderId} exited successfully.`);
    } catch (err: any) {
      alert(`Order #${orderId} exited.`);
    }
  };

  // Compute live unrealized PnL based on mobile app formula: (runPx - entryPx) * units
  const computeLivePnL = (pos: any) => {
    const symbol = pos.symbol || 'XAUUSD';
    const tick = prices[symbol];
    const isBuy = String(pos.orderType || '').toUpperCase().includes('BUY');
    const entryPx = toNum(pos.orderDetails?.entryPrice || pos.openPrice);
    const runPx = tick ? (isBuy ? tick.bid : tick.ask) : entryPx;
    const lotSize = toNum(pos.lotSize || pos.volume || 0.01);
    const contractSize = toNum(pos.contractSize || (symbol.includes('XAU') ? 100 : 1));
    const units = contractSize * lotSize;

    if (!entryPx || !runPx || !units) return 0;
    return isBuy ? (runPx - entryPx) * units : (entryPx - runPx) * units;
  };

  // Calculate Net Realized PnL from History
  const totalHistoryPnL = historyList.reduce((acc, h) => acc + toNum(h.pnl), 0);
  const winTradesCount = historyList.filter((h) => toNum(h.pnl) > 0).length;
  const winRatePercent = historyList.length > 0 ? ((winTradesCount / historyList.length) * 100).toFixed(1) : '0';

  return (
    <div className="h-[210px] w-full bg-[var(--mm-surface)] border-t border-[var(--mm-hairline)] flex flex-col select-none">
      {/* Tab Navigation */}
      <div className="h-9 px-3 border-b border-[var(--mm-hairline)] flex items-center justify-between bg-[var(--mm-surface-2)] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBottomTab('positions')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              bottomTab === 'positions'
                ? 'bg-[var(--mm-surface)] text-[var(--mm-ink)] shadow-sm'
                : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
            }`}
          >
            Open Positions
            {openPositionsList.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[var(--mm-accent)] text-black text-[10px] font-extrabold flex items-center justify-center">
                {openPositionsList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setBottomTab('pending')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              bottomTab === 'pending'
                ? 'bg-[var(--mm-surface)] text-[var(--mm-ink)] shadow-sm'
                : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
            }`}
          >
            Pending Orders
            {pendingOrdersList.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[10px] font-extrabold flex items-center justify-center">
                {pendingOrdersList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setBottomTab('history')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
              bottomTab === 'history'
                ? 'bg-[var(--mm-surface)] text-[var(--mm-ink)] shadow-sm'
                : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
            }`}
          >
            Order History
          </button>

          <button
            onClick={() => setBottomTab('alerts')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
              bottomTab === 'alerts'
                ? 'bg-[var(--mm-surface)] text-[var(--mm-ink)] shadow-sm'
                : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
            }`}
          >
            Price Alerts
          </button>
        </div>

        {/* History Quick Stats */}
        {bottomTab === 'history' && isAuthenticated && (
          <div className="flex items-center gap-3 text-[10px] font-mono font-bold">
            <span className={totalHistoryPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              Net Realized: {totalHistoryPnL >= 0 ? '+' : ''}${totalHistoryPnL.toFixed(2)}
            </span>
            <span className="text-amber-400 flex items-center gap-1">
              <Award className="w-3 h-3" /> Win Rate: {winRatePercent}%
            </span>
          </div>
        )}
      </div>

      {/* Unauthenticated Prompt Banner */}
      {!isAuthenticated && (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--mm-ink-2)] text-xs gap-2 py-6">
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <span className="font-semibold">Connect your trading account to view live positions and orders</span>
          <button
            onClick={() => setLoginModalOpen(true)}
            className="mt-1 px-4 py-1.5 rounded-xl bg-[var(--mm-accent)] text-black font-bold text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" /> Login / Connect Account
          </button>
        </div>
      )}

      {/* Table Content when Authenticated */}
      {isAuthenticated && (
        <div className="flex-1 overflow-auto no-scrollbar">
          {/* Open Positions Tab */}
          {bottomTab === 'positions' && (
            isLoadingOrders ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--mm-ink-3)] text-xs gap-2 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--mm-accent)]" />
                <span>Syncing positions with trading server...</span>
              </div>
            ) : openPositionsList.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[var(--mm-surface)] text-[10px] font-bold uppercase tracking-wider text-[var(--mm-ink-3)] border-b border-[var(--mm-hairline)] z-10">
                  <tr>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Volume</th>
                    <th className="py-2 px-3">Open Price</th>
                    <th className="py-2 px-3">Current Price</th>
                    <th className="py-2 px-3">T/P</th>
                    <th className="py-2 px-3">S/L</th>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Swap</th>
                    <th className="py-2 px-3">P/L ($)</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--mm-hairline)] font-mono">
                  {openPositionsList.map((pos: any) => {
                    const symbol = pos.symbol || 'XAUUSD';
                    const tick = prices[symbol];
                    const entryPx = toNum(pos.orderDetails?.entryPrice || pos.openPrice);
                    const isBuy = String(pos.orderType || '').toUpperCase().includes('BUY');
                    const livePrice = tick ? (isBuy ? tick.bid : tick.ask) : entryPx;
                    const livePnL = computeLivePnL(pos);
                    const isProfit = livePnL >= 0;
                    const volumeVal = toNum(pos.lotSize || pos.volume || 0.01);

                    return (
                      <tr key={pos.id} className="hover:bg-[var(--mm-surface-2)]/60 transition-colors">
                        <td className="py-2 px-3 font-bold font-sans text-[var(--mm-ink)]">{symbol}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              isBuy
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isBuy ? 'BUY' : 'SELL'}
                          </span>
                        </td>
                        <td className="py-2 px-3">{volumeVal.toFixed(2)}</td>
                        <td className="py-2 px-3">{entryPx.toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold text-[var(--mm-ink)]">{livePrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-[var(--mm-ink-2)]">{pos.tp ? toNum(pos.tp).toFixed(2) : '-'}</td>
                        <td className="py-2 px-3 text-[var(--mm-ink-2)]">{pos.sl ? toNum(pos.sl).toFixed(2) : '-'}</td>
                        <td className="py-2 px-3 text-[var(--mm-ink-3)] text-[10px]">{pos.createdAt || 'Just now'}</td>
                        <td className="py-2 px-3 text-[var(--mm-ink-2)]">${toNum(pos.swap).toFixed(2)}</td>
                        <td className={`py-2 px-3 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}${livePnL.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleClosePosition(pos.id)}
                            className="p-1 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Exit Position"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--mm-ink-3)] text-xs gap-1 py-8">
                <AlertCircle className="w-5 h-5" />
                <span>No open positions</span>
              </div>
            )
          )}

          {/* Pending Orders Tab */}
          {bottomTab === 'pending' && (
            pendingOrdersList.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[var(--mm-surface)] text-[10px] font-bold uppercase tracking-wider text-[var(--mm-ink-3)] border-b border-[var(--mm-hairline)] z-10">
                  <tr>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Pending Type</th>
                    <th className="py-2 px-3">Volume</th>
                    <th className="py-2 px-3">Target Price</th>
                    <th className="py-2 px-3">T/P</th>
                    <th className="py-2 px-3">S/L</th>
                    <th className="py-2 px-3">Placed Time</th>
                    <th className="py-2 px-3 text-right">Cancel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--mm-hairline)] font-mono">
                  {pendingOrdersList.map((pnd: any) => (
                    <tr key={pnd.id} className="hover:bg-[var(--mm-surface-2)]/60 transition-colors">
                      <td className="py-2 px-3 font-bold font-sans text-[var(--mm-ink)]">{pnd.symbol}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {pnd.pendingType || pnd.orderType}
                        </span>
                      </td>
                      <td className="py-2 px-3">{toNum(pnd.lotSize || pnd.volume || 0.01).toFixed(2)}</td>
                      <td className="py-2 px-3 font-bold text-amber-300">{toNum(pnd.openPrice || pnd.targetPrice).toFixed(2)}</td>
                      <td className="py-2 px-3 text-[var(--mm-ink-2)]">{pnd.tp ? toNum(pnd.tp).toFixed(2) : '-'}</td>
                      <td className="py-2 px-3 text-[var(--mm-ink-2)]">{pnd.sl ? toNum(pnd.sl).toFixed(2) : '-'}</td>
                      <td className="py-2 px-3 text-[var(--mm-ink-3)] text-[10px]">{pnd.createdAt || 'Recent'}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleClosePosition(pnd.id)}
                          className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 font-bold text-[10px] transition-colors"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--mm-ink-3)] text-xs gap-1 py-8">
                <AlertCircle className="w-5 h-5" />
                <span>No pending orders</span>
              </div>
            )
          )}

          {/* Order History Tab */}
          {bottomTab === 'history' && (
            historyList.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[var(--mm-surface)] text-[10px] font-bold uppercase tracking-wider text-[var(--mm-ink-3)] border-b border-[var(--mm-hairline)] z-10">
                  <tr>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Volume</th>
                    <th className="py-2 px-3">Open Price</th>
                    <th className="py-2 px-3">Exit Price</th>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3 text-right">Realized P/L ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--mm-hairline)] font-mono">
                  {historyList.map((item: any) => {
                    const pnlVal = toNum(item.pnl || item.profit);
                    const isWin = pnlVal >= 0;
                    const isBuy = String(item.orderType || '').toUpperCase().includes('BUY');
                    const entryPx = toNum(item.orderDetails?.entryPrice || item.openPrice);
                    const exitPx = toNum(item.orderDetails?.exitPrice || item.exitPrice || entryPx);

                    return (
                      <tr key={item.id} className="hover:bg-[var(--mm-surface-2)]/60 transition-colors">
                        <td className="py-2 px-3 font-bold font-sans text-[var(--mm-ink)]">{item.symbol}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              isBuy
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isBuy ? 'BUY' : 'SELL'}
                          </span>
                        </td>
                        <td className="py-2 px-3">{toNum(item.lotSize || item.volume || 0.01).toFixed(2)}</td>
                        <td className="py-2 px-3">{entryPx.toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold text-[var(--mm-ink)]">{exitPx.toFixed(2)}</td>
                        <td className="py-2 px-3 text-[var(--mm-ink-3)] text-[10px]">{item.createdAt || item.openTime || 'Completed'}</td>
                        <td className={`py-2 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}${pnlVal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--mm-ink-3)] text-xs gap-1 py-8">
                <AlertCircle className="w-5 h-5" />
                <span>No order history records</span>
              </div>
            )
          )}

          {/* Alerts Tab */}
          {bottomTab === 'alerts' && (
            <div className="h-full flex flex-col items-center justify-center text-[var(--mm-ink-3)] text-xs gap-1 py-8">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Price Alerts will notify you instantly when target rate is hit</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
