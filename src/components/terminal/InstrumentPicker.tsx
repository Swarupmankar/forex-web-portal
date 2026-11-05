"use client";
import {Dialog} from './Dialog';
import {MarketWatch} from '@/components/MarketWatch/MarketWatch';
import {useWorkspaceStore} from '@/store/useWorkspaceStore';

export function InstrumentPicker() {
  const open=useWorkspaceStore(s=>s.instrumentPickerOpen);
  return open?<Dialog title="Find an instrument" wide className="instrument-picker-dialog" initialFocus={()=>document.getElementById('instrument-picker-search')} onClose={()=>useWorkspaceStore.getState().setInstrumentPickerOpen(false)}><MarketWatch picker/></Dialog>:null;
}
