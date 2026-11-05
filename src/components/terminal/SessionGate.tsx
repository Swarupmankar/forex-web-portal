'use client';
import { useShallow } from 'zustand/react/shallow';
import { ArrowUpRight, LoaderCircle, LockKeyhole, Wallet, ArrowRight } from 'lucide-react';
import { switchTradingAccount } from '@/lib/accountSwitching';
import { Brand } from '@/components/terminal/Brand';
import { useAccountStore } from '@/store/useAccountStore';
import { useUIStore } from '@/store/useUIStore';
import { accountKindLabel } from '@/lib/accountSessions';
import { PORTAL_SIGN_IN, enterAccount } from '@/lib/portalHandoff';

// Shown instead of the terminal until a session exists, and when one ends. The terminal
// has no login form: every new session starts from the client portal.
export function SessionGate() {
  const access = useUIStore(s => s.access);
  const welcome = access === 'welcome';
  const message = useUIStore(s => s.accessMessage);
  const others = useAccountStore(useShallow(s => s.accounts.filter(a => !a.expired)));
  if (access === 'checking') return <div className="session-gate" role="status" aria-live="polite">
    <div className="session-gate-card"><Brand /><LoaderCircle className="spin session-gate-spinner" aria-hidden="true" /><p>Opening your trading account…</p></div>
  </div>;
  return <div className="session-gate session-entry">

    <section className="session-gate-card" aria-labelledby="session-gate-title">
      <Brand />
      <span className="session-gate-icon"><LockKeyhole aria-hidden="true" /></span>
      <h1 id="session-gate-title">{welcome ? 'Open your trading account' : 'Your trading session has ended'}</h1>
      <p>{message || 'Sign in to your client portal and press Trade on an account to continue.'}</p>
      <a className="button button-primary full-width" href={PORTAL_SIGN_IN}>Open client portal<ArrowUpRight /></a>
      {welcome && <ol className="session-entry-steps"><li>Sign in to your client portal.</li><li>Choose the trading account you want to use.</li><li>Press Trade to return here, connected to that account.</li></ol>}
      {process.env.NODE_ENV === 'development' && <button className="text-button" onClick={() => {switchTradingAccount('practice');useUIStore.getState().grantAccess();}}>Explore local practice<ArrowRight /></button>}
      {others.length > 0 && <div className="session-gate-accounts">
        <h2>Or continue with an account still signed in</h2>
        {others.map(a => <button key={a.id} className="button button-outline full-width" onClick={() => enterAccount(a.id)}>
          <Wallet aria-hidden="true" />{accountKindLabel(a.kind)} · {a.nickname || a.username}
        </button>)}
      </div>}
    </section>
  </div>;
}
