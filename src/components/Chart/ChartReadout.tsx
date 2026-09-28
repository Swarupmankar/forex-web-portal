'use client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { X } from 'lucide-react';
import { formatPrice } from '@/lib/market';
import type { Candle } from '@/lib/chart';
import { STUDY_INFO, type Studies, type StudyKey } from '@/lib/indicators';

export type ChartReadoutHandle = { hover: (candle: Candle | undefined) => void };

// Pointer movement updates this readout without re-rendering the trading surface.
export const ChartReadout = forwardRef<ChartReadoutHandle, {
  symbol: string;
  timeframe: string;
  latest?: Candle;
  studies: Studies;
  onRemove: (key: StudyKey) => void;
}>(function ChartReadout({ symbol, timeframe, latest, studies, onRemove }, ref) {
  const [hovered, setHovered] = useState<Candle>();
  useImperativeHandle(ref, () => ({ hover: setHovered }), []);
  useEffect(() => setHovered(undefined), [symbol, timeframe]);
  const candle = hovered || latest;
  return <div className="chart-readout">
    <div className="ohlc-readout" aria-label="Candle prices">
      {(['open', 'high', 'low', 'close'] as const).map((key, index) =>
        <span key={key}><b>{['O', 'H', 'L', 'C'][index]}</b>{formatPrice(candle?.[key], symbol)}</span>
      )}
    </div>
    <div className="active-studies">
      {(Object.keys(studies) as StudyKey[]).filter(key => studies[key].enabled).map(key =>
        <button key={key} style={{ color: STUDY_INFO[key].color }} aria-label={`Remove ${STUDY_INFO[key].short} indicator`} onClick={() => onRemove(key)}>
          {STUDY_INFO[key].short} {studies[key].period}<X aria-hidden="true" />
        </button>
      )}
    </div>
  </div>;
});
