"use client";
import { useShallow } from 'zustand/react/shallow';
import { Sun, Volume2, VolumeX, Moon, SlidersHorizontal, Search, Wallet, CircleHelp } from 'lucide-react';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useTheme } from '@/theme/theme';
import { Brand } from '@/components/terminal/Brand';
import { AccountSwitcher, type AccountSummary } from '@/components/terminal/AccountSwitcher';
import { CLIENT_PORTAL } from '@/lib/market';
import { WorkspaceHeading } from '@/components/terminal/WorkspaceHeading';
import { NotificationButton } from '@/components/terminal/ToastStack';
import { unlockTradeSound, playTradeSound } from '@/lib/tradeSound';
export function Header(props: AccountSummary) {
  const u = useUIStore(useShallow(s => ({ isAuthenticated: s.isAuthenticated, setSidebarTab: s.setSidebarTab, setDepositModalOpen: s.setDepositModalOpen })));
  const w = useWorkspaceStore(useShallow(s => ({ tradeSounds: s.tradeSounds, setTradeSounds: s.setTradeSounds, setPanel: s.setPanel, setFocus: s.setFocus, setSettingsOpen: s.setSettingsOpen })));
  const practice = usePracticeStore(s => s.mode === 'practice');
  const [theme, setTheme] = useTheme();
  return <header className="terminal-header">
    <a className="brand-link" href={CLIENT_PORTAL} aria-label="Movement Markets client portal"><Brand /></a>
    <button aria-label="Find an instrument" className="terminal-search" onClick={() => {
      useWorkspaceStore.getState().setInstrumentPickerOpen(true);
    }} title="Find an instrument (/)"><Search /><span>Find an instrument</span><kbd>/</kbd></button>
    <WorkspaceHeading />
    <div className="header-actions">
      <NotificationButton />
      <button className="icon-button header-sound" aria-label={w.tradeSounds ? 'Mute trade sounds' : 'Enable trade sounds'} title={w.tradeSounds ? 'Trade sounds on' : 'Trade sounds off'} aria-pressed={w.tradeSounds} onClick={() => {w.setTradeSounds(!w.tradeSounds);if(!w.tradeSounds){unlockTradeSound();void playTradeSound('filled');}}}>{w.tradeSounds ? <Volume2 /> : <VolumeX />}</button>
      <button className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
      <button className="icon-button" aria-label="Terminal preferences" onClick={() => w.setSettingsOpen(true)}><SlidersHorizontal /></button>
      <button className="icon-button header-help" aria-label="Keyboard shortcuts" onClick={() => useWorkspaceStore.getState().setHelpOpen(true)}><CircleHelp /></button>
      {!practice && u.isAuthenticated && <button className="button button-primary header-deposit" onClick={() => u.setDepositModalOpen(true)}><Wallet />Deposit</button>}
      <AccountSwitcher {...props}/>
    </div>
  </header>;
}
