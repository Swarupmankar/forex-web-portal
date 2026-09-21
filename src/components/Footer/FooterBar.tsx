'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Clock } from 'lucide-react';

interface FooterBarProps {
  equity?: number;
  freeMargin?: number;
  balance?: number;
  margin?: number;
  marginLevel?: number | null;
}

export const FooterBar: React.FC<FooterBarProps> = ({
  equity = 0,
  freeMargin = 0,
  balance = 0,
  margin = 0,
  marginLevel = null,
}) => {
  const [serverTime, setServerTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setServerTime(now.toTimeString().split(' ')[0]);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="h-7 w-full bg-[var(--mm-surface-2)] border-t border-[var(--mm-hairline)] px-3 flex items-center justify-between text-[11px] font-mono text-[var(--mm-ink-2)] select-none z-20 shrink-0">
      {/* Financial Metrics */}
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
        <div>
          <span>Equity: </span>
          <span className="font-bold text-[var(--mm-ink)]">${equity.toFixed(2)}</span>
        </div>

        <div>
          <span>Free Margin: </span>
          <span className="font-bold text-[var(--mm-ink)]">${freeMargin.toFixed(2)}</span>
        </div>

        <div>
          <span>Balance: </span>
          <span className="font-bold text-[var(--mm-ink)]">${balance.toFixed(2)}</span>
        </div>

        <div>
          <span>Margin: </span>
          <span className="font-bold text-[var(--mm-ink)]">${margin.toFixed(2)}</span>
        </div>

        <div>
          <span>Margin level: </span>
          <span className="font-bold text-[var(--mm-ink-3)]">{marginLevel ? `${marginLevel}%` : '—'}</span>
        </div>
      </div>

      {/* Market Sessions & Server Clock */}
      <div className="hidden md:flex items-center gap-3 border-l border-[var(--mm-hairline)] pl-3 text-[10px]">
        {/* World Market Sessions */}
        <div className="flex items-center gap-2 text-[var(--mm-ink-3)]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> SYD
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> TKY
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> LDN
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> NY
          </span>
        </div>

        {/* Server Clock */}
        <div className="flex items-center gap-1 text-[var(--mm-ink)]">
          <Clock className="w-3 h-3 text-[var(--mm-ink-3)]" />
          <span>{serverTime || '21:22:57'}</span>
        </div>

        {/* Latency */}
        <div className="flex items-center gap-1 text-emerald-400 font-bold">
          <Activity className="w-3 h-3" />
          <span>158ms</span>
        </div>
      </div>
    </footer>
  );
};
