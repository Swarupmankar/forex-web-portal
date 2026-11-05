type Clock = { schedule: typeof setTimeout; cancel: typeof clearTimeout };

/** Catch up with the engine's asynchronous persistence. Only reads are repeated.
 * Concurrent receipts/events share one reader and one bounded follow-up window. */
export function createExecutionRefresh(
  read: (generation: number) => Promise<void>,
  getGeneration: () => number,
  clock: Clock = { schedule: setTimeout, cancel: clearTimeout },
) {
  type Batch = { generation: number; running: boolean; queued: boolean; timers: ReturnType<typeof setTimeout>[] };
  let batch: Batch | undefined;
  const clear = (b: Batch) => { b.timers.forEach(clock.cancel); b.timers = []; };
  const current = (b: Batch) => batch === b && b.generation === getGeneration();
  async function drain(b: Batch) {
    if (!current(b)) { clear(b); return; }
    if (b.running || !b.queued) return;
    b.queued = false;
    b.running = true;
    try { await read(b.generation); }
    catch { /* Queries retain their error state; normal polling remains available. */ }
    finally {
      b.running = false;
      if (current(b) && b.queued) void drain(b);
      else if (!current(b)) clear(b);
    }
  }
  return () => {
    const generation = getGeneration();
    if (!batch || batch.generation !== generation) {
      if (batch) clear(batch);
      batch = { generation, running: false, queued: false, timers: [] };
    }
    const b = batch;
    clear(b);
    const queue = () => { if (current(b)) { b.queued = true; void drain(b); } else clear(b); };
    queue();
    b.timers = [600, 1200].map(delay => clock.schedule(queue, delay));
  };
}
