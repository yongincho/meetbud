import { Capability, PanelState, PresentationState } from './protocol/v1-ids.mjs';

export const DISPLAY_STALE_MS = 5000;

// Observation only: this projection must never dispatch Shows, grant approval,
// change privacy, or complete a task. Matching expression/progress does not
// establish matching caption, artwork, animation, or optical output.
export function projectDisplayAgreement(snapshot, now) {
  const intent = snapshot.hostIntent;
  const report = snapshot.deviceDisplayReport;
  const current = report && report.generation === snapshot.generation && report.session === snapshot.session;
  const age = current ? Math.max(0, now - report.receivedAt) : null;
  const base = { status: 'unavailable', receiptAgeMs: age, selectionMatchesIntent: null,
    transferComplete: false };
  if (snapshot.phase !== 'Ready' || !(snapshot.capabilities & Capability.DisplayReadback)) return base;
  if (intent?.status === 'rejected') return { ...base, status: 'rejected' };
  if (!current) return { ...base, status: 'pending' };
  if (age >= DISPLAY_STALE_MS) return { ...base, status: 'stale' };
  if (report.request !== snapshot.request || report.approval !== (snapshot.approval ?? 0)) {
    return { ...base, status: 'pending' };
  }
  if (intent && (intent.status !== 'accepted' || report.request !== intent.request ||
      report.lastAcceptedShowSequence !== intent.sequence)) return { ...base, status: 'pending' };
  const matches = intent ? report.selectedState === intent.state && report.progress === intent.progress : null;
  const complete = report.presentation === PresentationState.Complete &&
    report.completedRevision === report.selectionRevision && report.panel === PanelState.Ready;
  return { ...base, status: matches === false ? 'different' : complete ? 'transferred' :
    report.presentation === PresentationState.Failed ? 'failed' :
      report.presentation === PresentationState.Unknown ? 'unknown' : 'selected',
  selectionMatchesIntent: matches, transferComplete: complete };
}
