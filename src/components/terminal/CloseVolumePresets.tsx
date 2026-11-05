import { closeVolumePresets } from '@/lib/volume';

export function CloseVolumePresets({ open, value, onChange }: { open: number; value: string; onChange: (value: string) => void }) {
  return <div className="volume-presets" aria-label="Close volume presets">
    {closeVolumePresets(open).map(preset => <button key={preset.lots} type="button" aria-pressed={Number(value) === preset.lots} onClick={() => onChange(preset.lots.toFixed(2))}>{preset.label}</button>)}
  </div>;
}
