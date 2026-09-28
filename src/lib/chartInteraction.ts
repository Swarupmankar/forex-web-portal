/** Convert a pointer delta in rendered CSS pixels into the chart's own coordinates.
 * Browser zoom or a scaled ancestor must not make a dragged price jump. */
export function chartDragCoordinate(anchor: number, delta: number, chartHeight: number, renderedHeight: number) {
  if (![anchor, delta, chartHeight, renderedHeight].every(Number.isFinite) || chartHeight <= 2 || renderedHeight <= 0) return null;
  return Math.max(1, Math.min(chartHeight - 1, anchor + delta * chartHeight / renderedHeight));
}
export function chartPrice(value: string | number, digits: number): number | null {
  if (typeof value === 'string' && !value.trim()) return null;
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  const rounded = Number(price.toFixed(Math.max(0, Math.min(8, digits))));
  return rounded > 0 ? rounded : null;
}
