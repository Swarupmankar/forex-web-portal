"use client";
import { useEffect, useState } from 'react';
import { ArrowLeftRight, ChartCandlestick } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { usePracticeStore } from '@/store/usePracticeStore';
import { usePriceStore } from '@/store/usePriceStore';
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { useExecutableQuote } from '@/hooks/useExecutableQuote';
import { useGetAllStocksQuery } from '@/store/api/tradingApi';
import { subscribeSymbol, unsubscribeSymbol } from '@/services/priceSocket';
import { composeOrder, viewInstrument } from '@/lib/tradingWorkflow';
import { isQuoteExecutable } from '@/lib/freshness';
import { quoteSpread } from '@/lib/marketPresentation';
import { PREVIEW_FEED } from '@/lib/market';
import { PRACTICE_VOLUME } from '@/lib/volume';
import { InstrumentIcon } from './InstrumentIcon';

export function InstrumentDetails({ onNavigate }: { onNavigate?: () => void } = {}) {
  const symbol = useUIStore(s => s.activeSymbol);
  const authenticated = useUIStore(s => s.isAuthenticated);
  const practice = usePracticeStore(s => s.mode === 'practice');
  const connection = usePriceStore(s => s.connection);
  const { instrument, formatPrice } = useMarketDisplay();
  const quote = useExecutableQuote(symbol);
  const stocks = useGetAllStocksQuery(undefined, { skip: practice || !authenticated });
  const item = instrument(symbol);
  const metadata = practice ? { ...item, minLots: PRACTICE_VOLUME.min, maxLots: PRACTICE_VOLUME.max, lotStep: PRACTICE_VOLUME.step } : stocks.currentData?.find(s => s.symbol === symbol);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (practice || PREVIEW_FEED) return;
    subscribeSymbol(symbol);
    return () => unsubscribeSymbol(symbol);
  }, [practice, symbol]);
  const fresh = isQuoteExecutable(quote, now) && (practice || connection === 'connected');
  function trade(side: 'BUY' | 'SELL' = 'BUY') { composeOrder(symbol, side); onNavigate?.(); }
  function chart() { viewInstrument(symbol); onNavigate?.(); }
  return <aside className="instrument-details panel" aria-label={`Instrument details for ${symbol}`}>
    <div className="instrument-details-title"><InstrumentIcon symbol={symbol} /><div><h2>{symbol}</h2><p>{item.name}</p></div></div>
    <span className="instrument-category">{item.category}</span>
    <div className="instrument-detail-quotes">
      <button className="sell" aria-label={`Sell ${symbol}, open order ticket`} onClick={() => trade('SELL')}><span>Sell · Bid</span><strong>{formatPrice(quote?.bid, symbol)}</strong></button>
      <button className="buy" aria-label={`Buy ${symbol}, open order ticket`} onClick={() => trade('BUY')}><span>Buy · Ask</span><strong>{formatPrice(quote?.ask, symbol)}</strong></button>
    </div>
    <div className="instrument-feed"><span className={`status-dot ${fresh ? 'connected' : ''}`} />{practice ? 'Simulated quotes' : PREVIEW_FEED ? 'Illustrative quotes' : fresh ? 'Live quotes' : 'Waiting for fresh quotes'}</div>
    <dl className="instrument-specification">
      <div><dt>Spread <small>Ask − Bid</small></dt><dd>{formatPrice(quoteSpread(quote), symbol)}</dd></div>
      <div><dt>Contract size</dt><dd>{metadata?.contractSize?.toLocaleString() ?? '—'}</dd></div>
      <div><dt>Minimum volume</dt><dd>{metadata?.minLots !== undefined ? `${metadata.minLots} lots` : '—'}</dd></div>
      <div><dt>Volume step</dt><dd>{metadata?.lotStep !== undefined ? `${metadata.lotStep} lots` : '—'}</dd></div>
      <div><dt>Maximum volume</dt><dd>{metadata?.maxLots !== undefined ? `${metadata.maxLots} lots` : '—'}</dd></div>
    </dl>
    {stocks.isError && !practice && <button className="text-button instrument-retry" onClick={() => stocks.refetch()}>Retry instrument details</button>}
    <div className="instrument-details-actions">
      <button className="button button-primary" onClick={() => trade()}><ArrowLeftRight />Trade</button>
      <button className="button button-outline" onClick={chart}><ChartCandlestick />View chart</button>
    </div>
  </aside>;
}
