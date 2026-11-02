// One transcription in flight and one waiting phrase, and a place more for one that can't wait its
// turn to be let in (`urgent`: what was said with the talk button held). Never retain an unbounded
// promise chain.
export function phraseQueue() {
  const pending = [];
  let running = false;
  const drain = async () => {
    if (running) return;
    running = true;
    try {
      while (pending.length) {
        const entry = pending[0];
        try { await entry.task(); } catch { /* callers own transcription feedback */ }
        pending.shift();
        entry.resolve();
      }
    } finally { running = false; }
  };
  return {
    get size() { return pending.length; },
    // Only work accepted by this call belongs to this checkpoint; later speech cannot extend it.
    checkpoint() { return pending.at(-1)?.done ?? Promise.resolve(); },
    enqueue(task, urgent = false) {
      if (pending.length >= (urgent ? 3 : 2)) return false;
      let resolve;
      const done = new Promise(yes => { resolve = yes; });
      pending.push({ task, done, resolve });
      void Promise.resolve().then(drain);
      return true;
    },
  };
}
