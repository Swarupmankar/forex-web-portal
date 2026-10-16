let context: AudioContext | undefined;
export type TradeSound = 'filled' | 'pending' | 'closed' | 'updated';
export function unlockTradeSound() {
    if (typeof window === 'undefined' || !window.AudioContext)
        return;
    try {
        context ??= new window.AudioContext();
        if (context.state === 'suspended')
            void context.resume().catch(() => { });
    }
    catch { /* Sound must never block trading. */ }
}
export async function playTradeSound(kind: TradeSound) {
    unlockTradeSound();
    if (!context)
        return;
    try {
        if (context.state === 'suspended')
            await context.resume();
    }
    catch {
        return;
    }
    if (context.state !== 'running')
        return;
    const notes = kind === 'filled' ? [660, 880] : kind === 'closed' ? [740, 554] : kind === 'pending' ? [554, 660] : [660];
    try {
        notes.forEach((frequency, index) => {
            const start = context!.currentTime + index * 0.075;
            const oscillator = context!.createOscillator();
            const gain = context!.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.055, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
            oscillator.connect(gain);
            gain.connect(context!.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.15);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        });
    }
    catch { /* Audio is optional feedback, never an execution dependency. */ }
}
