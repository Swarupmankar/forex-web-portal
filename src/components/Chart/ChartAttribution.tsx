'use client';
import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog } from '@/components/terminal/Dialog';

export function ChartAttribution() {
  const [open, setOpen] = useState(false);
  return <div className="chart-attribution">
    <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" aria-label="Charts by TradingView" title="Chart rendering by TradingView">TradingView</a>
    <button type="button" className="chart-info-button" aria-label="Chart information and licence" aria-haspopup="dialog" onClick={() => setOpen(true)}><Info aria-hidden="true" /></button>
    {open && <Dialog title="Chart information" className="chart-info-dialog" onClose={() => setOpen(false)}>
      <p>The chart is drawn with TradingView Lightweight Charts™. Connected charts use your trading account’s price feed; practice charts use simulated prices.</p>
      <p className="chart-copyright">TradingView Lightweight Charts™<br />Copyright (с) 2024 TradingView, Inc.</p>
      <div className="chart-info-links"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView</a><a href="/licenses/lightweight-charts.txt" target="_blank" rel="noopener noreferrer">Open-source licence and notices</a></div>
    </Dialog>}
  </div>;
}
