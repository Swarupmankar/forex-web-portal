import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_STUDIES, normalizeStudies, type Studies, type StudyKey, type Study } from '@/lib/indicators';
interface ChartSettings {
    studies: Studies;
    // Solid bid and dashed ask price lines on the chart.
    showBidAsk: boolean;
    // Bar-close countdown chip on the price axis.
    showCountdown: boolean;
    update: (key: StudyKey, value: Partial<Study>) => void;
    setShowBidAsk: (value: boolean) => void;
    setShowCountdown: (value: boolean) => void;
    reset: () => void;
}
type Saved = { studies?: unknown; showBidAsk?: unknown; showCountdown?: unknown } | undefined;
const DEFAULTS = { studies: DEFAULT_STUDIES, showBidAsk: true, showCountdown: true };
export const useChartSettings = create<ChartSettings>()(persist((set) => ({
    ...DEFAULTS,
    update: (key, value) => set(s => ({ studies: normalizeStudies({ ...s.studies, [key]: { ...s.studies[key], ...value } }) })),
    setShowBidAsk: showBidAsk => set({ showBidAsk }),
    setShowCountdown: showCountdown => set({ showCountdown }),
    reset: () => set(DEFAULTS),
}), {
    name: 'mm-chart-studies-v1',
    version: 1,
    partialize: s => ({ studies: s.studies, showBidAsk: s.showBidAsk, showCountdown: s.showCountdown }),
    merge: (persisted, current) => {
        const saved = persisted as Saved;
        return {
            ...current,
            studies: normalizeStudies(saved?.studies),
            showBidAsk: typeof saved?.showBidAsk === 'boolean' ? saved.showBidAsk : current.showBidAsk,
            showCountdown: typeof saved?.showCountdown === 'boolean' ? saved.showCountdown : current.showCountdown,
        };
    },
}));
