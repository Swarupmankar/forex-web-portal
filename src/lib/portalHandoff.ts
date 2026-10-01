import { useAccountStore } from '@/store/useAccountStore';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { switchTradingAccount } from '@/lib/accountSwitching';
import { accountKindLabel } from '@/lib/accountSessions';
import { CLIENT_PORTAL } from '@/lib/market';

// The terminal has no login of its own. Users sign in to the client portal and press Trade
// on an account; the portal opens the terminal at `/#handoff=<one-time code>`. The fragment
// never reaches a server or an access log; the code is single use and valid for about a minute.
const PARAM = 'handoff';
const CODE = /^[A-Za-z0-9_-]{43}$/;

/** Where a visitor without a session goes: the portal's accounts page, behind its login. */
export const PORTAL_SIGN_IN = `${CLIENT_PORTAL.replace(/\/+$/, '')}/accounts`;
export function goToPortalSignIn() {
  window.location.replace(PORTAL_SIGN_IN);
}

/** Reads and removes a hand-off code from the URL. Returns '' when there is none. */
export function takeHandoffCode(): string {
  if (typeof window === 'undefined' || !window.location.hash) return '';
  const params = new URLSearchParams(window.location.hash.slice(1));
  const code = params.get(PARAM) ?? '';
  if (!params.has(PARAM)) return '';
  params.delete(PARAM);
  const rest = params.toString();
  // Strip it before anything async so a reload, bookmark or second effect run cannot replay it.
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`);
  return CODE.test(code) ? code : 'invalid';
}

function message(body: unknown, fallback: string) {
  const m = body && typeof body === 'object' ? (body as { message?: unknown }).message : undefined;
  return typeof m === 'string' && m.trim() ? m : fallback;
}

const FAILED = 'We could not open your trading account. Press Trade on the account in your client portal again.';

/** Redeems a hand-off code. Returns the chosen account id, or an error message. */
async function redeem(code: string): Promise<{ id: string } | { error: string }> {
  if (code === 'invalid') return { error: FAILED };
  try {
    const response = await fetch('/api/trading/v1/users/trading/web-session/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      cache: 'no-store',
      credentials: 'omit',
    });
    const body = await response.json().catch(() => undefined);
    if (!response.ok) return { error: message(body, FAILED) };
    return { id: useAccountStore.getState().connectHandoff(body) };
  } catch (error) {
    return { error: error instanceof Error && error.message ? error.message : FAILED };
  }
}

/** Opens a signed-in account and lets the terminal render. */
export function enterAccount(id: string) {
  switchTradingAccount(id);
  useUIStore.getState().grantAccess();
}

/** The account this tab was last using, or any other one still signed in. */
export function resumableAccount() {
  const { accounts, activeId } = useAccountStore.getState();
  return accounts.find(a => a.id === activeId && !a.expired) ?? accounts.find(a => !a.expired);
}

let starting: Promise<void> | undefined;

/**
 * Decides what this tab shows on load: the account chosen in the client portal, the
 * account this tab already had open (a reload), or a redirect to the portal's login.
 */
export function startTerminalSession() {
  starting ??= (async () => {
    useUIStore.getState().checkAuthSession();
    const code = takeHandoffCode();
    const notify = useWorkspaceStore.getState().notify;
    if (code) {
      const result = await redeem(code);
      if ('id' in result) {
        enterAccount(result.id);
        const account = useAccountStore.getState().accounts.find(a => a.id === result.id);
        notify(account ? `Signed in to ${accountKindLabel(account.kind)} account ${account.username}.` : 'Signed in from your client portal.', 'success');
        return;
      }
      const fallback = resumableAccount();
      if (fallback) { enterAccount(fallback.id); notify(result.error, 'error', { sticky: true }); return; }
      useUIStore.getState().endSession(result.error);
      return;
    }
    const resume = resumableAccount();
    if (resume) enterAccount(resume.id);
    else goToPortalSignIn();
  })();
  return starting;
}
