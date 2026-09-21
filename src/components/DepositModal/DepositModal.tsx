'use client';

import React, { useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { X, Wallet, Copy, Check, QrCode, ArrowRight } from 'lucide-react';

export const DepositModal: React.FC = () => {
  const { depositModalOpen, setDepositModalOpen } = useUIStore();
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState<number>(500);

  if (!depositModalOpen) return null;

  const walletAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in select-none">
      <div className="w-[440px] glass-card rounded-2xl p-5 border border-[var(--mm-hairline)] shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={() => setDepositModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] hover:bg-[var(--mm-surface-2)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--mm-hairline)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--mm-accent)] text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(176,240,0,0.4)]">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--mm-ink)]">Deposit Funds</h3>
            <p className="text-xs text-[var(--mm-ink-2)]">Instant account funding via USDT / Crypto</p>
          </div>
        </div>

        {/* Amount presets */}
        <div className="my-4 space-y-2">
          <label className="text-xs font-bold text-[var(--mm-ink)]">Select Deposit Amount (USD)</label>
          <div className="grid grid-cols-4 gap-2">
            {[100, 500, 1000, 5000].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                  amount === val
                    ? 'bg-[var(--mm-accent)] text-black border-[var(--mm-accent)] shadow-md'
                    : 'bg-[var(--mm-surface-2)] border-[var(--mm-hairline)] text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
                }`}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>

        {/* Crypto Address Box */}
        <div className="my-4 p-3 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs text-[var(--mm-ink-2)] font-semibold">
            <span>USDT (TRC20 / ERC20) Address</span>
            <span className="text-[10px] text-emerald-400 font-mono">Instant auto-credit</span>
          </div>

          <div className="flex items-center gap-2 bg-[var(--mm-surface)] border border-[var(--mm-hairline)] p-2 rounded-lg">
            <span className="text-xs font-mono text-[var(--mm-ink)] truncate flex-1">{walletAddress}</span>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md bg-[var(--mm-accent)] text-black font-bold hover:brightness-110 transition-all flex items-center gap-1 text-xs shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Submit CTA */}
        <div className="pt-2">
          <button
            onClick={() => {
              alert(`Deposit request for $${amount} submitted!`);
              setDepositModalOpen(false);
            }}
            className="w-full py-3 rounded-xl bg-[var(--mm-accent)] hover:brightness-110 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(176,240,0,0.3)]"
          >
            I Have Completed Deposit <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
