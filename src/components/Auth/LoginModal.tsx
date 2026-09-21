'use client';

import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { 
  useLoginTradingMutation, 
  useGetBrokersQuery, 
  useGetServersQuery 
} from '@/store/api/tradingApi';
import { X, ShieldCheck, Server, Building2, Key, UserCheck, Loader2, AlertCircle } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { loginModalOpen, setLoginModalOpen, setIsAuthenticated, setTradingAccountNo } = useUIStore();

  // Form State
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Brokers & Servers from Backend APIs
  const { data: brokersRes, isLoading: isLoadingBrokers } = useGetBrokersQuery(undefined);
  const { data: serversRes, isLoading: isLoadingServers } = useGetServersQuery(undefined);
  
  const [loginTrading, { isLoading: isLoggingIn }] = useLoginTradingMutation();

  // Extract arrays from API response objects (backend returns { brokers: [...] }, { servers: [...] })
  const brokersList: any[] = Array.isArray(brokersRes) 
    ? brokersRes 
    : (brokersRes as any)?.brokers || [
        { id: 1, name: 'Movement Markets Brokerage' },
        { id: 2, name: 'Xpert Trader Global' },
      ];

  const serversList: any[] = Array.isArray(serversRes) 
    ? serversRes 
    : (serversRes as any)?.servers || [
        { id: 1, name: 'Live-Server-US-01' },
        { id: 2, name: 'Demo-Server-EU-01' },
      ];

  // Set default selection when brokers/servers load
  useEffect(() => {
    if (brokersList.length > 0 && !selectedBroker) {
      setSelectedBroker(String(brokersList[0].id));
    }
  }, [brokersList, selectedBroker]);

  useEffect(() => {
    if (serversList.length > 0 && !selectedServer) {
      setSelectedServer(String(serversList[0].id));
    }
  }, [serversList, selectedServer]);

  if (!loginModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!accountNumber || !password) {
      setErrorMessage('Please enter trading account username and password');
      return;
    }

    try {
      const res = await loginTrading({
        tradingUsername: accountNumber,
        tradingPassword: password,
        brokerId: Number(selectedBroker) || 1,
        serverId: Number(selectedServer) || 1,
      }).unwrap();

      const token = res?.tokens?.access?.token || res?.token || res?.account?.token;
      if (token) {
        localStorage.setItem('trading_token', token);
      }
      const accId = String(res?.account?.tradingUsername || res?.account?.id || accountNumber);
      localStorage.setItem('trading_account_no', accId);
      
      setIsAuthenticated(true);
      setTradingAccountNo(accId);
      setLoginModalOpen(false);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to authenticate trading account';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-[430px] glass-card rounded-2xl p-6 border border-[var(--mm-hairline)] shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={() => setLoginModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--mm-hairline)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--mm-accent)] text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(176,240,0,0.4)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--mm-ink)]">Trading Account Login</h3>
            <p className="text-xs text-[var(--mm-ink-2)]">Connect with your broker and server credentials</p>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Existing Account Form */}
        <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3.5">
          {/* Broker Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--mm-ink-2)] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> Broker
              </span>
              {isLoadingBrokers && <Loader2 className="w-3 h-3 animate-spin text-[var(--mm-accent)]" />}
            </label>
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs font-semibold py-2 px-3 rounded-xl text-[var(--mm-ink)] focus:outline-none focus:border-[var(--mm-accent)]"
            >
              {brokersList.map((b: any) => (
                <option key={b.id || b.name} value={b.id} className="bg-[var(--mm-surface-2)] text-[var(--mm-ink)]">
                  {b.name || b.brokerName || `Broker #${b.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Server Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--mm-ink-2)] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> Execution Server
              </span>
              {isLoadingServers && <Loader2 className="w-3 h-3 animate-spin text-[var(--mm-accent)]" />}
            </label>
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs font-semibold py-2 px-3 rounded-xl text-[var(--mm-ink)] focus:outline-none focus:border-[var(--mm-accent)]"
            >
              {serversList.map((s: any) => (
                <option key={s.id || s.name} value={s.id} className="bg-[var(--mm-surface-2)] text-[var(--mm-ink)]">
                  {s.name || s.serverName || `Server #${s.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Account Username / ID */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--mm-ink-2)] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> Trading Account Username
            </label>
            <input
              type="text"
              required
              placeholder="Enter account ID (e.g. 8849201)"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs font-mono font-bold py-2 px-3 rounded-xl text-[var(--mm-ink)] focus:outline-none focus:border-[var(--mm-accent)] placeholder-[var(--mm-ink-3)]"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--mm-ink-2)] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> Trading Password
            </label>
            <input
              type="password"
              required
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs font-mono py-2 px-3 rounded-xl text-[var(--mm-ink)] focus:outline-none focus:border-[var(--mm-accent)] placeholder-[var(--mm-ink-3)]"
            />
          </div>

          {/* Submit CTA */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-[var(--mm-accent)] hover:brightness-110 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(176,240,0,0.3)] cursor-pointer"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Login Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
