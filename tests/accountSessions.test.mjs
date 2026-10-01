import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/accountSessions.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { AccountSessionVault, accountKind, loginSession, accountDetails, handoffSessions } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
const identity = { username: 'qa-100', brokerId: '1', serverId: '1', brokerName: 'Test broker', serverName: 'Test server' };
const session = (kind, token, serverId = '1') => loginSession({ tokens: { access: { token } }, account: { accountType: kind, baseCurrency: 'USD' } }, { ...identity, serverId });
test('account identity includes broker, server and trading username', () => {
  const vault = new AccountSessionVault();
  const real = session('REAL', 'test-real'), demo = session('DEMO', 'test-demo', '2');
  vault.add(real); vault.add(demo);
  assert.equal(vault.accounts.length, 2);
  assert.equal(vault.token, 'test-demo');
  const before = vault.generation;
  vault.activate(real.account.id);
  assert.equal(vault.token, 'test-real');
  assert.ok(vault.generation > before, 'old response generation must be invalidated');
  assert.equal(vault.accounts.find(a => a.id === real.account.id).kind, 'real');
  assert.equal(JSON.stringify(vault.accounts).includes('test-real'), false, 'menu state must not expose tokens');
});
test('practice transition invalidates pending reads without losing broker sessions', () => {
  const vault = new AccountSessionVault();
  const s = session('DEMO', 'test-demo'); vault.add(s);
  const generation = vault.generation;
  vault.invalidate();
  assert.notEqual(vault.generation, generation);
  assert.ok(vault.has(s.account.id));
  vault.activate(s.account.id);
  assert.equal(vault.token, 'test-demo');
});
test('disconnect removes only its session and never silently chooses another account', () => {
  const vault = new AccountSessionVault();
  const a = session('REAL', 'test-real'), b = session('DEMO', 'test-demo', '2');
  vault.add(a); vault.add(b); vault.remove(b.account.id);
  assert.equal(vault.token, undefined);
  assert.equal(vault.activeId, '');
  assert.equal(vault.accounts.length, 1);
  assert.throws(() => vault.activate(b.account.id));
});
test('tab session restore retains Real/Demo types and discards corrupt storage', () => {
  const vault = new AccountSessionVault(); vault.add(session('DEMO', 'demo', '2')); vault.add(session('REAL', 'real'));
  const restored = new AccountSessionVault(); restored.restore(vault.serialize());
  assert.deepEqual(restored.accounts, vault.accounts);
  assert.equal(restored.token, 'real');
  const corrupt = new AccountSessionVault(); corrupt.restore('{broken'); corrupt.restore(JSON.stringify({ version: 1, sessions: [{ account: {}, token: '' }] }));
  assert.equal(corrupt.accounts.length, 0);
  assert.equal(corrupt.token, undefined);
});
test('unknown account types and currencies are never invented', () => {
  assert.equal(accountKind(undefined), 'unknown');
  assert.equal(accountKind(undefined, 'false'), 'unknown');
  assert.equal(accountKind(undefined, false), 'real');
  assert.equal(accountKind(undefined, true), 'demo');
  const s = loginSession({ token: 'Bearer test' }, identity);
  assert.equal(s.account.kind, 'unknown');
  assert.equal(s.account.currency, undefined);
  assert.equal(s.token, 'test');
  assert.throws(() => loginSession({}, identity));
});
test('account refresh enriches metadata without changing the credential identity', () => {
  const s = session('REAL', 'real');
  const updated = accountDetails({ account: { accountType: 'REAL', tradingUsername: 'different', nickname: 'Primary', baseCurrency: 'EUR' } }, s.account);
  assert.equal(updated.id, s.account.id);
  assert.equal(updated.username, s.account.username);
  assert.equal(updated.nickname, 'Primary');
  assert.equal(updated.currency, 'EUR');
  assert.equal(accountDetails({}, updated).kind, 'real');
});
const chartSource = ts.transpileModule(readFileSync(new URL('../src/lib/connectedChartLevels.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { connectedChartLevels } = await import('data:text/javascript;base64,' + Buffer.from(chartSource).toString('base64'));
test('broker chart lines preserve entry/SL/TP and pending identity without invalid prices', () => {
  const levels = connectedChartLevels([
    { id: 1, symbol: 'EURUSD', orderType: 'BUY', lotSize: '0.1', orderDetails: { entryPrice: '1.1' }, sl: '1.05', tp: '1.2' },
    { id: 2, symbol: 'BTCUSD', orderType: 'SELL', openPrice: 60000 },
  ], [{ id: 3, symbol: 'EURUSD', orderType: 'SELL', targetPrice: 1.3, sl: 0, tp: 'invalid' }], 'EURUSD');
  assert.equal(levels.length, 4);
  assert.deepEqual(levels.map(l => l.price), [1.1, 1.05, 1.2, 1.3]);
  assert.equal(levels.at(-1).title, 'Pending Sell  · #3');
  assert.equal(new Set(levels.map(l => l.id)).size, 4);
});
test('an expired session keeps its identity, never authenticates, survives reload and reconnects in place', () => {
  const vault = new AccountSessionVault();
  const real = session('REAL', 'test-real');
  vault.add(real);
  const before = vault.generation;
  vault.expire(real.account.id);
  assert.equal(vault.token, undefined);
  assert.equal(vault.activeId, '');
  assert.ok(vault.generation > before);
  const row = vault.accounts.find(a => a.id === real.account.id);
  assert.equal(row.expired, true); assert.equal(row.username, 'qa-100'); assert.equal(row.serverName, 'Test server');
  assert.throws(() => vault.activate(real.account.id), /Reconnect/);
  const reloaded = new AccountSessionVault();
  reloaded.restore(vault.serialize());
  assert.equal(reloaded.accounts[0].expired, true);
  assert.equal(reloaded.token, undefined);
  assert.throws(() => reloaded.activate(real.account.id));
  reloaded.add(session('REAL', 'fresh-token'));
  assert.equal(reloaded.accounts.length, 1);
  assert.equal(reloaded.accounts[0].expired, undefined);
  assert.equal(reloaded.token, 'fresh-token');
});
test('client-portal hand-off connects every account and selects the chosen one', () => {
  const entry = (id, user, type, token, funds) => ({ account: { id, tradingUsername: user, accountType: type, brokerId: 3, serverId: 7, serverName: 'Live 1', brokerName: 'MM', baseCurrency: 'USD', fundsAvailable: funds, leverage: 200 }, tokens: { access: { token } } });
  const { sessions, activeId } = handoffSessions({ activeAccountId: 12, sessions: [entry(11, 'R-1', 'REAL', 't-real', '1500.25'), entry(12, 'D-1', 'DEMO', 't-demo', '10000')] });
  assert.equal(sessions.length, 2);
  assert.equal(activeId, JSON.stringify(['3', '7', 'D-1']));
  const demo = sessions.find(s => s.account.id === activeId);
  assert.equal(demo.account.kind, 'demo');
  assert.equal(demo.account.balance, 10000);
  assert.equal(demo.account.leverage, 200);
  assert.equal(sessions[0].account.balance, 1500.25);
  const vault = new AccountSessionVault();
  vault.merge(sessions); vault.activate(activeId);
  assert.equal(vault.token, 't-demo');
  assert.equal(vault.tokenFor(sessions[0].account.id), 't-real');
  const restored = new AccountSessionVault(); restored.restore(vault.serialize());
  assert.equal(restored.accounts.find(a => a.username === 'R-1').balance, 1500.25, 'balance survives a reload');
  assert.throws(() => handoffSessions({ activeAccountId: 99, sessions: [entry(11, 'R-1', 'REAL', 't', '1')] }), /selected trading account/);
});
