'use client';

import React, { useEffect } from 'react';
import { Header } from '@/components/Header/Header';
import { MarketWatch } from '@/components/MarketWatch/MarketWatch';
import { TradingChart } from '@/components/Chart/TradingChart';
import { PositionsTable } from '@/components/PositionsTable/PositionsTable';
import { OrderEntry } from '@/components/OrderEntry/OrderEntry';
import { FooterBar } from '@/components/Footer/FooterBar';
import { DepositModal } from '@/components/DepositModal/DepositModal';
import { LoginModal } from '@/components/Auth/LoginModal';
import { ProfileModal } from '@/components/Profile/ProfileModal';
import { initPriceSocket } from '@/services/priceSocket';
import { useUIStore } from '@/store/useUIStore';
import { usePriceStore } from '@/store/usePriceStore';
import { useGetAccountDetailsQuery, useGetOpenOrdersQuery } from '@/store/api/tradingApi';

const toNum = (val: any) => {
  const n = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return Number.isFinite(n) ? n : 0;
};

export default function TerminalPage() {
  const { checkAuthSession, isAuthenticated, tradingAccountNo, setTradingAccountNo } = useUIStore();
  const prices = usePriceStore((state) => state.prices);

  useEffect(() => {
    // Check local storage auth token session
    checkAuthSession();

    // Initialize live streaming price socket
    initPriceSocket();
  }, [checkAuthSession]);

  // Account queries when authenticated
  const { data: accountData } = useGetAccountDetailsQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: 10000,
  });

  const { data: openOrdersData } = useGetOpenOrdersQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: 3000,
  });

  // Sync real account number from backend if available
  useEffect(() => {
    if (isAuthenticated && accountData) {
      const accNo = accountData?.tradingUsername || accountData?.accountNumber || accountData?.id;
      if (accNo && String(accNo) !== tradingAccountNo) {
        setTradingAccountNo(String(accNo));
        localStorage.setItem('trading_account_no', String(accNo));
      }
    }
  }, [accountData, isAuthenticated, setTradingAccountNo, tradingAccountNo]);

  const openPositions = Array.isArray(openOrdersData?.openOrders) ? openOrdersData!.openOrders : [];

  // Calculate live floating PnL across all open orders
  const floatingPnL = openPositions.reduce((sum: number, pos: any) => {
    const symbol = pos.symbol || 'XAUUSD';
    const tick = prices[symbol];
    const isBuy = String(pos.orderType || '').toUpperCase().includes('BUY');
    const entryPx = toNum(pos.orderDetails?.entryPrice || pos.openPrice);
    const runPx = tick ? (isBuy ? tick.bid : tick.ask) : entryPx;
    const lotSize = toNum(pos.lotSize || pos.volume || 0.01);
    const contractSize = toNum(pos.contractSize || (symbol.includes('XAU') ? 100 : 1));
    const units = contractSize * lotSize;

    if (!entryPx || !runPx || !units) return sum;
    const pnl = isBuy ? (runPx - entryPx) * units : (entryPx - runPx) * units;
    return sum + pnl;
  }, 0);

  const rawBalance = isAuthenticated
    ? toNum(openOrdersData?.balance ?? accountData?.balance ?? accountData?.fundsAvailable ?? accountData?.accountBalance ?? 0)
    : 0;
  const rawMargin = isAuthenticated ? toNum(openOrdersData?.marginUsed ?? accountData?.margin ?? 0) : 0;
  const liveEquity = isAuthenticated ? rawBalance + floatingPnL : 0;
  const liveFreeMargin = isAuthenticated ? liveEquity - rawMargin : 0;
  const liveMarginLevel = isAuthenticated && rawMargin > 0 ? (liveEquity / rawMargin) * 100 : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--mm-bg)] overflow-hidden font-sans">
      {/* Top Navigation Header */}
      <Header balance={rawBalance} accountType={accountData?.accountType || (accountData?.isDemo ? 'DEMO' : 'REAL')} />

      {/* Main Terminal Grid Split */}
      <main className="flex-1 flex min-h-0 w-full overflow-hidden">
        {/* Left Column: Market Watch & Sidebar Views */}
        <MarketWatch />

        {/* Center Column: Chart & Positions Table */}
        <section className="flex-1 flex flex-col min-w-0 h-full border-r border-[var(--mm-hairline)]">
          <TradingChart />
          <PositionsTable />
        </section>

        {/* Right Column: Order Ticket Entry */}
        <OrderEntry />
      </main>

      {/* Bottom Status & Financial Metrics Footer */}
      <FooterBar 
        equity={liveEquity}
        freeMargin={liveFreeMargin}
        balance={rawBalance}
        margin={rawMargin}
        marginLevel={liveMarginLevel}
      />

      {/* Modals */}
      <DepositModal />
      <LoginModal />
    </div>
  );
}
