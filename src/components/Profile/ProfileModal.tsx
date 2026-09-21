'use client';

import React from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useGetUserProfileQuery, useGetAccountDetailsQuery } from '@/store/api/tradingApi';
import { X, User, ShieldCheck, Mail, Cpu, Layers, DollarSign, LogOut } from 'lucide-react';

export const ProfileModal: React.FC = () => {
  const { profileModalOpen, setProfileModalOpen, tradingAccountNo, setIsAuthenticated } = useUIStore();
  const { data: profileData } = useGetUserProfileQuery(undefined);
  const { data: accountData } = useGetAccountDetailsQuery(undefined);

  if (!profileModalOpen) return null;

  const handleLogout = () => {
    localStorage.removeItem('trading_token');
    localStorage.removeItem('access_token');
    setIsAuthenticated(false);
    setProfileModalOpen(false);
    alert('Logged out from trading session.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-[440px] glass-card rounded-2xl p-6 border border-[var(--mm-hairline)] shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={() => setProfileModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--mm-hairline)]">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--mm-accent)] to-emerald-400 text-black font-extrabold text-xl flex items-center justify-center shadow-[0_0_20px_rgba(176,240,0,0.3)]">
            {accountData?.nickname?.[0] || profileData?.firstName?.[0] || 'T'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--mm-ink)]">
                {accountData?.nickname || (profileData?.firstName ? `${profileData.firstName} ${profileData.lastName || ''}` : 'Authenticated Trader')}
              </h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                accountData?.accountType === 'REAL'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {accountData?.accountType || 'DEMO'}
              </span>
            </div>
            <p className="text-xs text-[var(--mm-ink-2)] flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 text-[var(--mm-accent)]" /> {profileData?.email || 'Connected Trading Session'}
            </p>
          </div>
        </div>

        {/* Account Metadata Grid */}
        <div className="my-4 grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
            <span className="text-[10px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-1">
              Trading Account
            </span>
            <span className="text-sm font-mono font-bold text-[var(--mm-ink)] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> #{accountData?.tradingUsername || tradingAccountNo || 'Account'}
            </span>
          </div>

          <div className="p-3 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
            <span className="text-[10px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-1">
              Account Leverage
            </span>
            <span className="text-sm font-mono font-bold text-amber-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> 1:{accountData?.leverage || 500}
            </span>
          </div>

          <div className="p-3 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
            <span className="text-[10px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-1">
              Base Currency
            </span>
            <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> {accountData?.baseCurrency || 'USD'}
            </span>
          </div>

          <div className="p-3 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
            <span className="text-[10px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-1">
              Execution Server
            </span>
            <span className="text-sm font-mono font-bold text-[var(--mm-ink)] flex items-center gap-1 truncate">
              <Cpu className="w-3.5 h-3.5 text-sky-400" /> {accountData?.serverName || 'Live Execution Server'}
            </span>
          </div>
        </div>

        {/* Security & Logout Actions */}
        <div className="pt-2">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Disconnect & Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
