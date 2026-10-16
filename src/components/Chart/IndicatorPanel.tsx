'use client';
import { useState } from 'react';
import { Dialog } from '@/components/terminal/Dialog';
import { useChartSettings } from '@/store/useChartSettings';
import { STUDY_INFO, validPeriod, type StudyKey } from '@/lib/indicators';
export function IndicatorPanel({ onClose }: {
    onClose: () => void;
}) {
    const { studies, update } = useChartSettings();
    const [draft, setDraft] = useState(studies), [error, setError] = useState('');
    return <Dialog title="Indicators" onClose={onClose} wide>
  <p className="muted">Choose studies for this workspace. Settings are saved on this device.</p>
  <form onSubmit={e => { e.preventDefault(); if (Object.values(draft).some(s => !validPeriod(s.period)) || !Number.isFinite(draft.bollinger.deviation) || draft.bollinger.deviation! < 0.5 || draft.bollinger.deviation! > 4) {
        setError('Use a whole-number period from 2 to 200 and a band deviation from 0.5 to 4.');
        return;
    } (Object.keys(draft) as StudyKey[]).forEach(key => update(key, draft[key])); onClose(); }}>
   <div className="study-options">{(Object.keys(STUDY_INFO) as StudyKey[]).map(key => <div className="study-option" key={key}>
    <label className="study-check"><input type="checkbox" checked={draft[key].enabled} onChange={e => setDraft(s => ({ ...s, [key]: { ...s[key], enabled: e.target.checked } }))}/><span><strong style={{ color: STUDY_INFO[key].color }}>{STUDY_INFO[key].short}</strong><b>{STUDY_INFO[key].name}</b><small>{STUDY_INFO[key].description}</small></span></label>
    <div className="study-inputs"><label>Period<input aria-label={`${STUDY_INFO[key].short} period`} type="number" min={2} max={200} step={1} value={draft[key].period || ''} onChange={e => setDraft(s => ({ ...s, [key]: { ...s[key], period: Number(e.target.value) } }))}/></label>{key === 'bollinger' && <label>Deviation<input aria-label="Bollinger deviation" type="number" min={0.5} max={4} step={0.5} value={draft[key].deviation || ''} onChange={e => setDraft(s => ({ ...s, bollinger: { ...s.bollinger, deviation: Number(e.target.value) } }))}/></label>}</div>
   </div>)}</div>
   {error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary full-width" type="submit">Apply indicators</button>
  </form>
 </Dialog>;
}
