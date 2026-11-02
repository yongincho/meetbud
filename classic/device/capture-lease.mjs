export { phraseQueue } from './phrase-queue.mjs';

const RENEW_INTERVAL_MS = 20_000;
const ACK_DEADLINE_MS = 5_000;
const CAPTURE_LEASE_CAPABILITY = 1 << 8;

/** True when the connected client negotiated capture-lease support. */
export function canRenewCapture(client) {
  if (!client || typeof client.renewCapture !== 'function') return false;
  let capabilities;
  try {
    capabilities = client.snapshot?.().capabilities ?? client.capabilities;
  } catch {
    return false;
  }
  return Number.isInteger(capabilities) && (capabilities & CAPTURE_LEASE_CAPABILITY) !== 0;
}

/** Keep one capture lease alive while its owning recording remains valid. */
export function captureLease({ client, request, recording, valid, onFailure, timers = globalThis }) {
  if (!client || typeof client.renewCapture !== 'function' || typeof recording !== 'function' ||
      typeof valid !== 'function' || typeof onFailure !== 'function' ||
      typeof timers?.setTimeout !== 'function' || typeof timers?.clearTimeout !== 'function') {
    throw new TypeError('Invalid capture lease callbacks, client or timer interface.');
  }

  let retired = false;
  let renewalTimer = null;
  let acknowledgementTimer = null;

  const clear = name => {
    if (name === 'renewal' && renewalTimer !== null) {
      timers.clearTimeout(renewalTimer);
      renewalTimer = null;
    }
    if (name === 'acknowledgement' && acknowledgementTimer !== null) {
      timers.clearTimeout(acknowledgementTimer);
      acknowledgementTimer = null;
    }
  };

  const retireWithFailure = () => {
    if (retired) return;
    retired = true;
    clear('renewal');
    clear('acknowledgement');
    onFailure();
  };

  const isValid = () => {
    if (retired) return false;
    let current;
    try { current = valid(); } catch { current = false; }
    if (!current) retireWithFailure();
    return !!current && !retired;
  };

  const arm = () => {
    if (retired) return;
    renewalTimer = timers.setTimeout(() => {
      renewalTimer = null;
      if (!isValid()) return;

      let recordingId;
      try { recordingId = recording(); } catch { recordingId = 0; }
      if (!Number.isSafeInteger(recordingId) || recordingId <= 0) {
        retireWithFailure();
        return;
      }

      let settled = false;
      acknowledgementTimer = timers.setTimeout(() => {
        acknowledgementTimer = null;
        if (settled || retired) return;
        settled = true;
        retireWithFailure();
      }, ACK_DEADLINE_MS);
      // Keep the cadence anchored to dispatch; the shorter ack deadline prevents overlap.
      arm();

      let result;
      try {
        result = client.renewCapture(recordingId, request, () => !retired && valid());
      } catch {
        settled = true;
        clear('acknowledgement');
        retireWithFailure();
        return;
      }

      Promise.resolve(result).then(value => {
        if (settled || retired) return;
        settled = true;
        clear('acknowledgement');
        if (value === false || !isValid()) {
          if (!retired) retireWithFailure();
          return;
        }
      }, () => {
        if (settled || retired) return;
        settled = true;
        clear('acknowledgement');
        retireWithFailure();
      });
    }, RENEW_INTERVAL_MS);
  };

  arm();
  return {
    stop() {
      if (retired) return;
      retired = true;
      clear('renewal');
      clear('acknowledgement');
    },
  };
}
