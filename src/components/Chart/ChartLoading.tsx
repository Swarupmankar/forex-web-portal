'use client';
export function ChartLoading({symbol, timeframe}: {symbol:string; timeframe:string}) {
  return <div className="chart-loading" role="status" aria-live="polite">
    <div className="chart-loading-bars" aria-hidden="true">{[40,57,47,70,61,85,66,76,55,67,49,72,58,82,69,90,72,61].map((height,i)=><i key={i} style={{height:`${height}%`,animationDelay:`${i*45}ms`}} />)}</div>
    <div className="chart-loading-copy"><span className="chart-loading-spinner" aria-hidden="true"/><strong>Loading {symbol}</strong><span>{timeframe} candles</span></div>
  </div>;
}
