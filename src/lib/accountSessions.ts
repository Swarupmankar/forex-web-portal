export type AccountKind = 'real' | 'demo' | 'unknown';
export interface TradingAccount {
  id: string;
  username: string;
  kind: AccountKind;
  brokerId: string;
  serverId: string;
  brokerName: string;
  serverName: string;
  currency?: string;
  nickname?: string;
  // The trading session ended; the account stays listed so it can be reconnected in one step.
  expired?: boolean;
}
export interface AccountLogin {
  username: string;
  brokerId: string;
  serverId: string;
  brokerName: string;
  serverName: string;
}
type Session = { account: TradingAccount; token: string };
const record = (v: unknown): Record<string, any> => v && typeof v === 'object' ? v as Record<string, any> : {};
const text = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
export function accountKind(value: unknown, isDemo?: unknown): AccountKind {
  const kind = text(value).toUpperCase();
  if (kind === 'REAL' || kind === 'LIVE') return 'real';
  if (kind === 'DEMO') return 'demo';
  return isDemo === true ? 'demo' : isDemo === false ? 'real' : 'unknown';
}
export const accountKindLabel = (kind: AccountKind) => kind === 'unknown' ? 'Trading' : kind === 'real' ? 'Real' : 'Demo';
export function accountDetails(value: unknown, previous: TradingAccount): TradingAccount {
  const root = record(value), a = record(root.account ?? value);
  const currency = text(a.currency ?? a.baseCurrency).toUpperCase();
  const kind = accountKind(a.accountType, a.isDemo);
  return {
    ...previous,
    // The login identity stays stable, even when an account response omits it.
    kind: kind === 'unknown' ? previous.kind : kind,
    nickname: text(a.nickname) || previous.nickname,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : previous.currency,
    serverName: text(a.serverName) || previous.serverName,
    brokerName: text(a.brokerName) || previous.brokerName,
  };
}
export function loginSession(value: unknown, login: AccountLogin): Session {
  const r = record(value), a = record(r.account);
  const token = text(r.tokens?.access?.token ?? r.token ?? a.token).replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('The account service did not return a trading session. Please try again.');
  const username = text(a.tradingUsername) || login.username;
  const account = accountDetails(r, {
    ...login, username, kind: 'unknown',
    id: JSON.stringify([login.brokerId, login.serverId, username]),
  });
  return { account, token };
}

/** Tokens are isolated to this terminal tab, never included in account menu state. */
export class AccountSessionVault {
  private sessions = new Map<string, Session>();
  activeId = '';
  generation = 0;
  get accounts() { return [...this.sessions.values()].map(s => ({ ...s.account })); }
  get token() { return this.sessions.get(this.activeId)?.token || undefined; }
  has(id: string) { return this.sessions.has(id); }
  add(session: Session) {
    this.sessions.set(session.account.id, session);
    this.activate(session.account.id);
  }
  activate(id: string) {
    if (!this.sessions.get(id)?.token) throw new Error('Reconnect this trading account to continue.');
    this.activeId = id;
    this.generation++;
  }
  invalidate() { this.generation++; }
  // Drops the token but keeps broker, server and username, marked expired.
  expire(id: string) {
    const current = this.sessions.get(id);
    if (!current) return;
    this.sessions.set(id, { token: '', account: { ...current.account, expired: true } });
    if (this.activeId === id) { this.activeId = ''; this.generation++; }
  }
  remove(id: string) {
    this.sessions.delete(id);
    if (this.activeId === id) { this.activeId = ''; this.generation++; }
  }
  update(id: string, data: unknown) {
    const current = this.sessions.get(id);
    if (current) this.sessions.set(id, { ...current, account: accountDetails(data, current.account) });
  }
  serialize() { return JSON.stringify({ version: 1, activeId: this.activeId, sessions: [...this.sessions.values()] }); }
  restore(raw: string | null) {
    if (!raw) return;
    try {
      const v = JSON.parse(raw);
      if (v.version !== 1 || !Array.isArray(v.sessions)) return;
      for (const s of v.sessions.slice(0, 20)) {
        const a = record(s.account);
        if (typeof s.token !== 'string' || !text(a.username) || !text(a.id)) continue;
        const seed = { username: text(a.username), brokerId: text(a.brokerId), serverId: text(a.serverId), brokerName: text(a.brokerName), serverName: text(a.serverName) };
        // Expired rows are restored without a token and can never authenticate.
        const expired = !s.token;
        const restored = loginSession({ token: s.token || 'expired', account: { accountType: a.kind, nickname: a.nickname, currency: a.currency } }, seed);
        this.sessions.set(restored.account.id, expired ? { token: '', account: { ...restored.account, expired: true } } : restored);
      }
      this.activeId = this.sessions.get(v.activeId)?.token ? v.activeId : '';
      this.generation++;
    } catch { /* Invalid storage never creates an authenticated account. */ }
  }
}
