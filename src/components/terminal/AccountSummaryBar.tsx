"use client";
import { useState } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useAccountMetrics } from '@/hooks/useAccountMetrics';
import { useAccountStore } from '@/store/useAccountStore';
import { usePracticeStore } from '@/store/usePracticeStore';

export function AccountSummaryBar() {
  const [expanded, setExpanded] = useState(false);
  // Owns account synchronization and subscriptions used to value all open positions.
  const m = useAccountMetrics({ syncAccount: true });
  const practice = usePracticeStore(s => s.mode === 'practice');
  const currency = useAccountStore(s => s.accounts.find(a => a.id === s.activeId)?.currency);
  const unit = practice ? 'USD' : currency || '';
  const pnl = m.equity !== undefined && m.balance !== undefined ? m.equity - m.balance : undefined;
  const values = [
    ['Floating P&L', pnl], ['Balance', m.balance], ['Equity', m.equity],
    ['Used margin', m.margin], ['Free margin', m.freeMargin], ['Margin level', m.marginLevel],
  ] as const;
  return <section className="desktop-account-summary" data-expanded={expanded} aria-label="Account figures" aria-busy={m.loading}>
    <dl id="account-figures">{values.map(([label, value], i) => <div key={label} className={i === 0 || i === 2 || i === 5 ? 'figure-primary' : 'figure-secondary'}>
      <dt>{label}{i !== 5 && unit && <span> · {unit}</span>}</dt>
      <dd className={i === 0 && value ? value > 0 ? 'positive' : 'negative' : ''}>
        {value !== undefined && Number.isFinite(value)
          ? `${i === 0 && value > 0 ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${i === 5 ? '%' : ''}`
          : '—'}
      </dd>
    </div>)}</dl>
    <button className="account-figures-toggle" aria-label={expanded ? 'Show fewer account figures' : 'Show all account figures'} aria-expanded={expanded} aria-controls="account-figures" onClick={() => setExpanded(!expanded)}><ChevronDown /></button>
    {(m.error || m.settling) && <div className="summary-state" role="status">
      {m.error ? <button onClick={m.refetch}><RefreshCw />Refresh figures</button> : 'Balance settling…'}
    </div>}
  </section>;
}
