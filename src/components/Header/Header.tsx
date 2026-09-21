'use client';

import React from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useTheme } from '@/theme/theme';
import { 
  Zap, 
  Sun, 
  Moon, 
  Bell, 
  RefreshCw, 
  Plus, 
  ChevronDown, 
  Wallet,
  User,
  ShieldCheck,
  KeyRound
} from 'lucide-react';

interface HeaderProps {
  balance?: number;
  accountType?: string;
}

export const Header: React.FC<HeaderProps> = ({ balance = 0, accountType = 'DEMO' }) => {
  const { 
    activeSymbol, 
    setActiveSymbol, 
    oneClickTrading, 
    setOneClickTrading, 
    setDepositModalOpen,
    setLoginModalOpen,
    setSidebarTab,
    isAuthenticated,
    tradingAccountNo
  } = useUIStore();
  const [theme, applyTheme] = useTheme();

  const symbolTabs = ['BTCUSD', 'XAUUSD', 'EURUSD'];

  return (
    <header className="glass-header h-[54px] w-full flex items-center justify-between px-3 z-30 select-none">
      {/* Left: Brand Logo & Symbol Quick Tabs */}
      <div className="flex items-center gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 pr-2 border-r border-[var(--mm-hairline)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--mm-accent)] flex items-center justify-center font-bold text-black text-lg shadow-[0_0_12px_rgba(176,240,0,0.4)]">
            M
          </div>
          <span className="font-bold tracking-tight text-base hidden md:inline text-[var(--mm-ink)]">
            movements<span className="text-[var(--mm-accent)]">markets</span>
          </span>
        </div>

        {/* Quick Symbol Switcher Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {symbolTabs.map((sym) => {
            const isActive = activeSymbol === sym;
            return (
              <button
                key={sym}
                onClick={() => setActiveSymbol(sym)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-[var(--mm-surface-2)] text-[var(--mm-ink)] border border-[var(--mm-hairline)] shadow-sm'
                    : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[var(--mm-accent)]' : 'bg-transparent'}`} />
                {sym}
              </button>
            );
          })}
          <button
            onClick={() => setSidebarTab('add-symbols')}
            className="p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors"
            title="Add Symbol in Sidebar"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Quick Controls & Account info */}
      <div className="flex items-center gap-3">
        {/* One Click Toggle */}
        <div className="hidden lg:flex items-center gap-2 bg-[var(--mm-surface-2)] px-2.5 py-1 rounded-full border border-[var(--mm-hairline)]">
          <span className="text-xs font-medium text-[var(--mm-ink-2)] flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> One Click
          </span>
          <button
            onClick={() => setOneClickTrading(!oneClickTrading)}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
              oneClickTrading ? 'bg-[var(--mm-accent)]' : 'bg-[var(--mm-hairline)]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-black transition-transform ${
                oneClickTrading ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Live Server Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>

        {/* Account Selector / Connect Account */}
        {isAuthenticated ? (
          <div 
            onClick={() => setSidebarTab('profile')}
            className="flex items-center gap-2 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] px-2.5 py-1 rounded-lg cursor-pointer hover:border-[var(--mm-accent)] transition-colors"
            title="View Profile in Sidebar"
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              accountType.toUpperCase() === 'REAL' 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {accountType}
            </span>
            <div className="text-right leading-none">
              <div className="text-xs font-bold text-[var(--mm-ink)]">${balance.toFixed(2)}</div>
              <div className="text-[10px] text-[var(--mm-ink-3)] font-mono">#{tradingAccountNo || 'Account'}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--mm-ink-2)]" />
          </div>
        ) : (
          <button
            onClick={() => setLoginModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[var(--mm-surface-2)] border border-[var(--mm-accent)] text-[var(--mm-accent)] font-bold text-xs flex items-center gap-1.5 hover:bg-[var(--mm-accent)] hover:text-black transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" /> Login Account
          </button>
        )}

        {/* Deposit Button */}
        <button
          onClick={() => setDepositModalOpen(true)}
          className="bg-[var(--mm-accent)] hover:brightness-110 text-black font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(176,240,0,0.3)]"
        >
          <Wallet className="w-3.5 h-3.5" />
          Deposit
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-1 border-l border-[var(--mm-hairline)] pl-2">
          {/* Refresh */}
          <button className="p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Notifications */}
          <button className="p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--mm-accent)]" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile */}
          <button 
            onClick={() => setSidebarTab('profile')}
            className="p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors"
            title="View Profile in Sidebar"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
