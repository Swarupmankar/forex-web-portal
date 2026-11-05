import { createHash } from 'node:crypto';

export interface SessionServices {
  engineBase: string;
  pricefeedBase: string;
  accountId?: string;
  username?: string;
  brokerId?: number;
  serverId?: number;
  accountType: 'REAL' | 'DEMO';
}
type Config = { backend: URL | null; engine: string | null };
type CachedServices = { expires: number; binding?: SessionServices; pending?: Promise<SessionServices> };
const cache = new Map<string, CachedServices>();
const CACHE_MS = 60000;
const routingError = () => new Error('Trading services are not configured for this account’s broker and server.');
function sessionKey(auth: string | null, config: Config, env: Record<string, string | undefined>) {
  if (!auth?.startsWith('Bearer ') || !config.backend) return null;
  return createHash('sha256').update(JSON.stringify([auth, config.backend.href, config.engine,
    env.NEXT_PUBLIC_ENGINE_URL, env.NEXT_PUBLIC_PRICEFEED_URL, env.TRADING_SERVICE_ALLOWED_ORIGINS])).digest('hex');
}
function save(key: string, value: CachedServices) {
  if (!cache.has(key) && cache.size >= 1000) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
}
const object = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const positiveId = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;

/** Only HTTPS services on operator-approved origins. Browser-supplied URLs are never used. */
export function trustedService(value: unknown, env: Record<string, string | undefined>): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    const configured = [env.NEXT_PUBLIC_ENGINE_URL, env.NEXT_PUBLIC_PRICEFEED_URL].flatMap(raw => {
      try { return raw ? [new URL(raw).origin] : []; } catch { return []; }
    });
    const allowed = (env.TRADING_SERVICE_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (![...configured, ...allowed].includes(url.origin)) return null;
    return (url.origin + url.pathname).replace(/\/+$/, '');
  } catch { return null; }
}

export function bindingFromAccount(value: unknown, config: Config, env: Record<string, string | undefined>, directory?: unknown): SessionServices | null {
  const root = object(value), account = object(root.account ?? root.data?.account ?? root.data ?? root);
  // The authenticated account endpoint exposes its services directly; login replies
  // carry the same values inside Server. Neither shape comes from client input.
  const direct = account.serverUrl !== undefined || account.priceFeedUrl !== undefined;
  const server = object(directory ?? (direct ? { url: account.serverUrl, priceFeedUrl: account.priceFeedUrl, accountType: account.accountType } : account.Server));
  const brokerId = positiveId(account.brokerId ?? account.user?.brokerId);
  const serverId = positiveId(account.serverId ?? account.Server?.id);
  const accountType = String(server.accountType ?? account.accountType ?? '').toUpperCase();
  if ((!direct && (!brokerId || !serverId)) || (direct && (!account.id || !account.tradingUsername)) || (server.id != null && Number(server.id) !== serverId) || !['REAL', 'DEMO'].includes(accountType)) return null;
  if (server.isActive === false || (['REAL', 'DEMO'].includes(String(account.accountType).toUpperCase()) && String(account.accountType).toUpperCase() !== accountType)) return null;
  if (account.Server?.accountType && String(account.Server.accountType).toUpperCase() !== accountType) return null;
  const engineBase = trustedService(server.url, env), pricefeedBase = trustedService(server.priceFeedUrl, env);

  return engineBase && pricefeedBase ? { engineBase, pricefeedBase, ...(account.id && { accountId: String(account.id) }), ...(account.tradingUsername && { username: String(account.tradingUsername) }), ...(brokerId && { brokerId }), ...(serverId && { serverId }), accountType: accountType as 'REAL' | 'DEMO' } : null;
}

/** Only call with a response fetched by this server from the authenticated account endpoint. */
export function cacheAccountServices(auth: string | null, value: unknown, config: Config, env: Record<string, string | undefined> = process.env) {
  const key = sessionKey(auth, config, env);
  if (!key) return;
  const binding = bindingFromAccount(value, config, env);
  // An invalid/newer account snapshot must also supersede an older discovery in flight.
  if (!binding) { cache.delete(key); return; }
  save(key, { binding, expires: Date.now() + CACHE_MS });
}

export async function resolveSessionServices(auth: string | null, config: Config, env: Record<string, string | undefined> = process.env): Promise<SessionServices> {
  const key = sessionKey(auth, config, env);
  if (!key) throw new Error('Open your trading account again from the client portal.');
  const saved = cache.get(key);
  if (saved?.binding && saved.expires > Date.now()) return saved.binding;
  if (saved?.pending) return saved.pending;
  const entry: CachedServices = { expires: 0 };
  save(key, entry);
  entry.pending = discover(auth!, config, env).then(binding => {
    if (cache.get(key) !== entry) {
      const latest = cache.get(key);
      if (latest?.binding && latest.expires > Date.now()) return latest.binding;
      throw routingError();
    }
    entry.binding = binding;
    entry.expires = Date.now() + CACHE_MS;
    return binding;
  }).catch(error => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  }).finally(() => { entry.pending = undefined; });
  return entry.pending;
}

async function discover(auth: string, config: Config, env: Record<string, string | undefined>): Promise<SessionServices> {
  const read = async (path: string) => {
    const res = await fetch(new URL(path, config.backend!), { headers: { Authorization: auth, Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('Unable to verify the trading server for this account.');
    return res.json();
  };
  const value = await read('v1/users/trading/account');

  let binding = bindingFromAccount(value, config, env);
  if (!binding) {
    const root = object(value), a = object(root.account ?? root.data?.account ?? root.data ?? root);
    const broker = positiveId(a.brokerId ?? a.user?.brokerId), serverId = positiveId(a.serverId ?? a.Server?.id);
    if (broker && serverId) {
      const result = await read(`v1/users/auth/servers?brokerId=${broker}`);
      const rows = Array.isArray(result) ? result : result.servers ?? result.data?.servers ?? result.data;
      const server = Array.isArray(rows) ? rows.find(s => Number(s.id) === serverId && s.isActive !== false) : undefined;
      if (server) binding = bindingFromAccount(value, config, env, server);
    }
  }
  if (!binding) throw routingError();
  return binding;
}
