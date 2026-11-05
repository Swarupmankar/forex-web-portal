export type ChartPalette = { up: string; down: string; muted: string; background: string; grid: string };
export const FALLBACK_CHART_PALETTE: Record<'dark' | 'light', ChartPalette> = {
    dark: { up: '#6fe08f', down: '#ff7b7b', muted: '#b0b0b0', background: '#1c1c1c', grid: '#262626' },
    light: { up: '#198046', down: '#d33636', muted: '#68717d', background: '#ffffff', grid: '#edf0f4' },
};
// Theme colours for the bid/ask lines from the page's CSS tokens, normalised through a canvas
// to hex/rgba because the chart cannot parse every CSS colour syntax.
export function readChartPalette(theme: 'dark' | 'light'): ChartPalette {
    const fallback = FALLBACK_CHART_PALETTE[theme];
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    if (canvas) canvas.width = canvas.height = 1;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx)
        return fallback;
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, color: string) => {
        const raw = styles.getPropertyValue(name).trim();
        if (!raw)
            return color;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillStyle = raw; // an invalid value leaves the fallback in place
        // Modern canvas can serialize color-mix as color(srgb ...), which
        // Lightweight Charts 4 cannot parse. Read the sRGB pixel instead.
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    };
    return {
        up: read('--mm-pos', fallback.up), down: read('--mm-neg', fallback.down),
        muted: read('--mm-ink-2', fallback.muted), background: read('--chart-bg', fallback.background),
        grid: read('--mm-line-soft', fallback.grid),
    };
}
