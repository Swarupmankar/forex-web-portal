"use client";
import { useState, useEffect, useMemo } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  useLoginTradingMutation,
  useGetBrokersQuery,
  useGetServersQuery,
} from "@/store/api/tradingApi";
import { useAccountStore } from '@/store/useAccountStore';
import { switchTradingAccount } from '@/lib/accountSwitching';
import { Dialog } from "@/components/terminal/Dialog";
import { Brand } from "@/components/terminal/Brand";
import { CLIENT_PORTAL, errorMessage } from "@/lib/market";
export function LoginModal() {
  const u = useUIStore();
  const [account, setAccount] = useState(""),
    [password, setPassword] = useState(""),
    [broker, setBroker] = useState(""),
    [server, setServer] = useState(""),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  const brokers = useGetBrokersQuery(undefined, { skip: !u.loginModalOpen }),
    servers = useGetServersQuery(broker, {
      skip: !u.loginModalOpen || !broker,
    });
  const [login, { isLoading }] = useLoginTradingMutation();
  const brokerList = useMemo(
    () =>
      Array.isArray(brokers.data) ? brokers.data : brokers.data?.brokers || [],
    [brokers.data],
  );
  const serverList = useMemo(
    () =>
      Array.isArray(servers.currentData)
        ? servers.currentData
        : servers.currentData?.servers || [],
    [servers.currentData],
  );
  // Reconnecting an expired account: only the password needs to be entered again.
  useEffect(() => {
    if (!u.loginModalOpen || !u.reconnect) return;
    setAccount(u.reconnect.username);
    if (u.reconnect.brokerId) setBroker(u.reconnect.brokerId);
    if (u.reconnect.serverId) setServer(u.reconnect.serverId);
  }, [u.loginModalOpen, u.reconnect]);
  useEffect(() => {
    if (brokerList.length && !broker) setBroker(String(brokerList[0].id));
  }, [brokerList, broker]);
  useEffect(() => {
    if (serverList.length && !server) setServer(String(serverList[0].id));
  }, [serverList, server]);
  if (!u.loginModalOpen) return null;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!broker || !server || !account.trim() || !password) return;
    try {
      const r = await login({
        tradingUsername: account.trim(),
        tradingPassword: password,
        brokerId: Number(broker),
        serverId: Number(server),
      }).unwrap();
      const selectedBroker = brokerList.find((b: any) => String(b.id) === broker);
      const selectedServer = serverList.find((s: any) => String(s.id) === server);
      const id = useAccountStore.getState().connect(r, {
        username: account.trim(), brokerId: broker, serverId: server,
        brokerName: selectedBroker?.name || selectedBroker?.brokerName || '',
        serverName: selectedServer?.name || selectedServer?.serverName || '',
      });
      switchTradingAccount(id);
      u.setLoginModalOpen(false);
      setPassword("");
      useWorkspaceStore.getState().notify("Trading account connected.");
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not connect. Check your trading credentials and try again.",
        ),
      );
    }
  }
  return (
    <Dialog
      title="Connect trading account"
      onClose={() => {
        if (!isLoading) {
          u.setLoginModalOpen(false);
          setPassword("");
          setError("");
        }
      }}
    >
      <div className="login-brand">
        <Brand />
      </div>
      <p className="muted">
        Connect a Real or Demo account using its trading credentials. You can then switch accounts from the top bar.
      </p>
      <form className="login-form" onSubmit={submit}>
        <div className="form-row">
          <label>
            Broker
            <select
              value={broker}
              required
              onChange={(e) => {
                setBroker(e.target.value);
                setServer("");
              }}
              disabled={brokers.isFetching}
            >
              <option value="">
                {brokers.isFetching ? "Loading…" : "Choose broker"}
              </option>
              {brokerList.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.brokerName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Server
            <select
              value={server}
              required
              onChange={(e) => setServer(e.target.value)}
              disabled={servers.isFetching || !broker}
            >
              <option value="">
                {servers.isFetching ? "Loading…" : "Choose server"}
              </option>
              {serverList.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.serverName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(brokers.isError || servers.isError) && (
          <p className="form-error" role="alert">
            Connection settings couldn’t load.{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                brokers.refetch();
                if (broker) servers.refetch();
              }}
            >
              Retry
            </button>
          </p>
        )}
        <label>
          Trading account ID
          <input
            autoComplete="username"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="Your trading username"
            required
          />
        </label>
        <label>
          Trading password
          <div className="password-field">
            <input
              autoComplete="current-password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="icon-button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="button button-primary full-width"
          disabled={isLoading || !server || !broker}
        >
          {isLoading ? "Connecting…" : !broker || !server ? "Loading servers…" : "Connect account"}
          <ArrowRight />
        </button>
        <p className="helper">
          <ShieldCheck /> Your client-portal password may differ from your
          trading password.
        </p>
        <p className="session-privacy">Your password is never saved. Connected sessions stay in this terminal tab.</p>
        <a
          className="text-button full-width"
          href={`${CLIENT_PORTAL}/accounts`}
        >
          Find your trading accounts
          <ArrowRight />
        </a>
      </form>
    </Dialog>
  );
}
