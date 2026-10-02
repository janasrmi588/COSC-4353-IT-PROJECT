// Small shared rules so every screen computes position, status, and wait the same way.
// These are plain functions: pass the data in, get an answer out (no React needed).

// Team decision: a waiting entry is shown as "almost ready" when it is this close to the front.
export const ALMOST_READY_POSITION = 2;

// Waiting entries for one service, in arrival order (earliest first).
export function getWaitingQueue(entries, serviceId) {
  return entries
    .filter((e) => e.serviceId === serviceId && e.status === 'waiting')
    .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
}

// 1-based position of an entry in its service queue, or null if it is not waiting.
export function getPosition(entries, entry) {
  if (entry.status !== 'waiting') return null;
  const index = getWaitingQueue(entries, entry.serviceId).findIndex((e) => e.id === entry.id);
  return index === -1 ? null : index + 1;
}

// What to show on screen: waiting | almost ready | served | canceled
export function getDisplayStatus(entry, position) {
  if (entry.status !== 'waiting') return entry.status;
  return position !== null && position <= ALMOST_READY_POSITION ? 'almost ready' : 'waiting';
}

// Rough estimate in minutes: everyone ahead of you takes about the service's expected duration.
export function getEstimatedWait(position, expectedDuration) {
  if (position === null) return 0;
  return (position - 1) * expectedDuration;
}

// A user's current (waiting) entries, with service and position filled in.
export function getActiveEntries(entries, services, userEmail) {
  return entries
    .filter((e) => e.userEmail === userEmail && e.status === 'waiting')
    .map((entry) => {
      const service = services.find((s) => s.id === entry.serviceId);
      const position = getPosition(entries, entry);
      return {
        entry,
        service,
        position,
        peopleAhead: position === null ? 0 : position - 1,
        displayStatus: getDisplayStatus(entry, position),
        estimatedWait: getEstimatedWait(position, service.expectedDuration),
      };
    });
}

// The History screen: a user's finished entries, newest first.
export function getHistory(entries, services, userEmail) {
  return entries
    .filter((e) => e.userEmail === userEmail && e.status !== 'waiting')
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .map((e) => ({
      id: e.id,
      date: e.finishedAt.slice(0, 10),
      serviceName: services.find((s) => s.id === e.serviceId).name,
      outcome: e.status === 'served' ? 'Served' : 'Canceled',
    }));
}
