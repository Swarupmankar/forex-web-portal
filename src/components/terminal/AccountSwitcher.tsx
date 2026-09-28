'use client';
import { useState } from 'react';
import { Check, ChevronDown, ArrowUpRight, Plus, LogOut, Wallet, FlaskConical, RefreshCw } from 'lucide-react';
import { Dialog } from './Dialog';
import { useAccountStore } from '@/store/useAccountStore';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { switchTradingAccount, disconnectTradingAccount } from '@/lib/accountSwitching';
import { accountKindLabel } from '@/lib/accountSessions';
import { practiceMetrics } from '@/lib/practice';
import { CLIENT_PORTAL, TRADING_ENABLED } from '@/lib/market';

export interface AccountSummary {
  balance?: number; equity?: number; freeMargin?: number;
  loading?: boolean; error?: boolean; onRefresh: () => void;
}
function money(value?: number, currency?: string) {
  if (value === undefined) return '—';
  try { return value.toLocaleString('en-US', currency ? { style: 'currency', currency } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return value.toFixed(2); }
}
export function AccountSwitcher(summary: AccountSummary) {
  const [open, setOpen] = useState(false), [reset, setReset] = useState(false);
  const { accounts, activeId, hydrated } = useAccountStore();
  const mode = usePracticeStore(s => s.mode);
  const paper = usePracticeStore(s => s.account), quotes = usePracticeStore(s => s.quotes);
  const metrics = practiceMetrics(paper, quotes);
  const active = accounts.find(a => a.id === activeId);
  const practice = mode === 'practice';
  const kind = practice ? 'Practice' : active ? accountKindLabel(active.kind) : 'Not connected';
  const name = practice ? 'Practice account' : active?.nickname || active?.username || 'Connect account';
  const currency = practice ? 'USD' : active?.currency;
  function choose(id: string) {
    switchTradingAccount(id); setOpen(false);
    useWorkspaceStore.getState().notify(id === 'practice' ? 'Switched to Practice. Your simulated trades are restored.' : 'Account switched. Loading its balances and positions.', 'info');
  }
  return <>
    <button className="account-selector" aria-label={`Switch account, ${kind}${!practice && active ? ` ${active.username}` : ''}`} aria-haspopup="dialog" aria-expanded={open} disabled={!hydrated} onClick={() => setOpen(true)}>
      <span className={`account-type-dot ${practice ? 'is-practice' : active?.kind === 'real' ? 'is-real' : 'is-demo'}`} />
      <span className="account-selector-text"><strong>{money(summary.balance, currency)}</strong><small>{kind}{practice ? ' account' : active ? ` · ${active.username}` : ''}</small></span>
      <ChevronDown />
    </button>
    {open && <Dialog title="Switch account" className="account-switch-dialog" onClose={() => setOpen(false)}>
      <div className="account-summary">
        <div className="account-summary-title"><span className={`account-kind-tag is-${practice ? 'practice' : active?.kind || 'unknown'}`}>{kind}</span><span>{name}</span>{!practice && active && <button className="icon-button" aria-label="Refresh account balances" onClick={summary.onRefresh} disabled={summary.loading}><RefreshCw className={summary.loading ? 'spin' : ''}/></button>}</div>
        <dl className="switcher-metrics"><div><dt>Balance{currency ? ` (${currency})` : ''}</dt><dd>{money(summary.balance, currency)}</dd></div><div><dt>Equity</dt><dd>{money(summary.equity, currency)}</dd></div><div><dt>Free margin</dt><dd>{money(summary.freeMargin, currency)}</dd></div></dl>
        <p>{practice ? 'Virtual funds · simulated prices' : !active ? 'Connect an account to load balances and positions' : !TRADING_ENABLED ? 'Account connected · trading temporarily unavailable' : 'Connected trading account'}</p>
        {summary.error && <p className="form-error" role="alert">Balances could not load. Refresh to try again.</p>}
      </div>
      <div className="account-list-heading"><h3>Your workspace</h3><span>{accounts.length + 1} {accounts.length ? 'accounts' : 'account'}</span></div>
      <button className={`switch-account-row ${practice ? 'is-active' : ''}`} aria-pressed={practice} onClick={() => choose('practice')}>
        <span className="switch-account-icon"><FlaskConical /></span>
        <span className="switch-account-copy"><strong>Practice account</strong><small>Saved in this browser · virtual USD</small></span>
        <span className="switch-account-end"><strong>{money(metrics.balance, 'USD')}</strong>{practice && <Check aria-label="Current account"/>}</span>
      </button>
      {accounts.length > 0 && <div className="account-list-heading"><h3>Connected accounts</h3><span>This terminal tab</span></div>}
      {accounts.map(a => <div className="connected-account-row" key={a.id}>
        <button className={`switch-account-row ${!practice && a.id === activeId ? 'is-active' : ''} ${a.expired ? 'is-expired' : ''}`} aria-label={a.expired ? `Reconnect expired account ${a.username}` : `Switch to ${accountKindLabel(a.kind)} account ${a.username}`} aria-pressed={!practice && a.id === activeId} onClick={() => { if (a.expired) { setOpen(false); useUIStore.getState().openReconnect(a); } else choose(a.id); }}>
          <span className="switch-account-icon"><Wallet /></span>
          <span className="switch-account-copy"><strong>{a.nickname || a.username}<span className={`account-kind-tag is-${a.kind}`}>{accountKindLabel(a.kind)}</span></strong><small>{a.expired ? 'Session expired · Reconnect' : [a.nickname ? a.username : '', a.serverName || a.brokerName, a.currency].filter(Boolean).join(' · ') || 'Trading account'}</small></span>
          {!practice && a.id === activeId && <Check aria-label="Current account"/>}
        </button>
        <button className="icon-button disconnect-account" aria-label={`Disconnect account ${a.username}`} title="Disconnect this account" onClick={() => disconnectTradingAccount(a.id)}><LogOut /></button>
      </div>)}
      <button className="connect-account-row" onClick={() => { setOpen(false); useUIStore.getState().setLoginModalOpen(true); }}><Plus /><span>Connect {accounts.length ? 'another' : 'a trading'} account<small>Use your Real or Demo trading credentials</small></span><ChevronDown /></button>
      <div className="account-switch-footer"><a href={`${CLIENT_PORTAL}/accounts`}>Manage accounts <ArrowUpRight /></a><button onClick={() => { setOpen(false); setReset(true); }}>Practice settings</button></div>
      <p className="session-privacy">Switching clears unfinished orders and turns off one-click trading.</p>
    </Dialog>}
    {reset && <Dialog title="Practice account settings" onClose={() => setReset(false)}>
      <p className="muted">Explore the terminal with virtual USD and simulated prices. Your trades are saved in this browser.</p>
      <dl className="detail-list"><div><dt>Practice leverage</dt><dd>1:100</dd></div><div><dt>Commission &amp; swap</dt><dd>None in this simulator</dd></div><div><dt>Pending orders &amp; exit levels</dt><dd>Run while practice is open</dd></div></dl>
      <p className="notice-note">Reset removes your practice positions, pending orders and history and restores $10,000 in virtual funds.</p>
      <button className="button button-outline full-width" onClick={() => { usePracticeStore.getState().reset(); useUIStore.getState().resetOrderDraft(); setReset(false); useWorkspaceStore.getState().notify('Practice account reset to $10,000.'); }}>Reset practice account</button>
    </Dialog>}
  </>;
}
