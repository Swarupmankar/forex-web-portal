"use client";
import { useState } from 'react';
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { artworkLegs, artworkPath, artworkKind } from '@/lib/instrumentArtwork';

function Artwork({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  const src = artworkPath(code);
  return <span className={`asset-disc asset-${artworkKind(code)}`}>
    {src && !failed ? <img src={src} alt="" width="40" height="40" draggable={false} onError={() => setFailed(true)} />
      : <span>{code.slice(0, 3)}</span>}
  </span>;
}

// The same locally served artwork and metadata-first symbol mapping as XpertTrader.
export function InstrumentIcon({ symbol }: { symbol: string }) {
  const { instrument } = useMarketDisplay();
  const meta = instrument(symbol);
  const { base, quote } = artworkLegs(symbol, { base: meta.baseCurrency, quote: meta.quoteCurrency });
  return <span aria-hidden="true" className={`instrument-icon instrument-art app-artwork${quote ? ' asset-pair' : ''}`}>
    <Artwork key={base} code={base} />
    {quote && <Artwork key={`quote:${quote}`} code={quote} />}
  </span>;
}
