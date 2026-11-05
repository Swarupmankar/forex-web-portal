let context: AudioContext | undefined;
export type TradeSound = 'filled' | 'pending' | 'closed' | 'updated' | 'alert';
const heard=new Set<string>();
let lastSoundAt=0;
export async function playTradeSoundOnce(key:string, kind:TradeSound) {
    if(heard.has(key))return false;
    heard.add(key);
    if(heard.size>500)heard.delete(heard.values().next().value!);
    // Coalesce near-simultaneous fills instead of playing many tones over each other.
    const started=Date.now();
    if(started-lastSoundAt<120)return false;
    lastSoundAt=started;
    const played=await playTradeSound(kind);
    if(!played){heard.delete(key);if(lastSoundAt===started)lastSoundAt=0;}
    return played;
}
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
        return false;
    try {
        if (context.state === 'suspended')
            await context.resume();
    }
    catch {
        return false;
    }
    if (context.state !== 'running')
        return false;
    const notes = kind === 'filled' ? [660, 880] : kind === 'closed' ? [740, 554] : kind === 'pending' ? [554, 660] : kind === 'alert' ? [880, 740, 880] : [660];
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
        return true;
    }
    catch { return false; /* Audio is optional feedback, never an execution dependency. */ }
}
