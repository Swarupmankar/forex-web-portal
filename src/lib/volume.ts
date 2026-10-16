export type VolumeSpec = { min: number; max: number; step: number };
type LotMeta = { minLots?: number; maxLots?: number; lotStep?: number } | undefined;
export const PRACTICE_VOLUME: VolumeSpec = { min: 0.01, max: 100, step: 0.01 };
// The order proxy accepts at most 100 lots in 0.01 steps (src/lib/server/proxyPolicy.ts), so instrument
// metadata can only narrow these limits, never widen them.
const SERVER_MAX_LOTS = 100, SERVER_MIN_STEP = 0.01;
// Orders at or above this size always open the review dialog, even with one-click on.
export const LARGE_ORDER_LOTS = 10;
const positive = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined);
// Practice uses fixed limits; connected accounts use the instrument's own limits, with safe defaults.
export function volumeSpec(practice: boolean, meta?: LotMeta): VolumeSpec {
    if (practice)
        return PRACTICE_VOLUME;
    const step = Math.max(positive(meta?.lotStep) ?? SERVER_MIN_STEP, SERVER_MIN_STEP);
    const min = Math.max(positive(meta?.minLots) ?? step, step);
    return { min, max: Math.max(min, Math.min(positive(meta?.maxLots) ?? SERVER_MAX_LOTS, SERVER_MAX_LOTS)), step };
}
const decimals = (step: number) => Math.min(8, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
export function validateVolume(lots: number, spec: VolumeSpec): string | null {
    const range = `${spec.min}–${spec.max} lots, in steps of ${spec.step}`;
    if (!Number.isFinite(lots) || lots <= 0)
        return "Enter a volume greater than zero.";
    if (lots < spec.min - 1e-9 || lots > spec.max + 1e-9 || Math.abs(lots / spec.step - Math.round(lots / spec.step)) > 1e-6)
        return `Use ${range}.`;
    return null;
}
// Moves to the next valid volume up or down (an off-grid value goes to its nearest grid neighbour
// in that direction), staying within the limits.
export function stepVolume(lots: number, spec: VolumeSpec, direction: 1 | -1): number {
    const base = Number.isFinite(lots) ? lots : spec.min;
    const units = base / spec.step;
    const snapped = (direction === 1 ? Math.floor(units + 1e-9) + 1 : Math.ceil(units - 1e-9) - 1) * spec.step;
    return Number(Math.min(spec.max, Math.max(spec.min, snapped)).toFixed(decimals(spec.step)));
}
export const needsReview = (lots: number) => lots >= LARGE_ORDER_LOTS;
