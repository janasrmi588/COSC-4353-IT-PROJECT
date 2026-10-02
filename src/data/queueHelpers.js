export const ALMOST_READY_POSITION = 2;

function getService(services, entry) {
  return services.find((s) => s.id === entry.serviceId);
}

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

function findService(services, entry) {
  return services.find((service) => service.id === entry.serviceId);
}

export function getWaitingQueue(entries, services) {
  const waiting = entries.filter((entry) => entry.status === "waiting");

  waiting.sort((a, b) => {
    const priorityA = PRIORITY_RANK[findService(services, a).priority];
    const priorityB = PRIORITY_RANK[findService(services, b).priority];

    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    return new Date(a.joinedAt) - new Date(b.joinedAt);
  });

  return waiting;
}

export function getPosition(entries, services, entry) {
  const queue = getWaitingQueue(entries, services);

  for (let i = 0; i < queue.length; i++) {
    if (queue[i].id === entry.id) {
      return i + 1;
    }
  }
  return null;
}

export function getDisplayStatus(entry, position) {
  if (entry.status !== "waiting") {
    return entry.status;
  }
  if (position !== null && position <= ALMOST_READY_POSITION) {
    return "almost ready";
  }
  return "waiting";
}

export function getEstimatedWait(queue, services, position) {
  if (position === null) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < position - 1; i++) {
    total += findService(services, queue[i]).expectedDuration;
  }
  return total;
}

export function getActiveEntries(entries, services, userEmail) {
  const queue = getWaitingQueue(entries, services);
  const results = [];

  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];

    if (entry.userEmail !== userEmail) {
      continue;
    }

    const position = i + 1;

    results.push({
      entry: entry,
      service: findService(services, entry),
      position: position,
      peopleAhead: position - 1,
      displayStatus: getDisplayStatus(entry, position),
      estimatedWait: getEstimatedWait(queue, services, position),
    });
  }

  return results;
}

export function getHistory(entries, services, userEmail) {
  return entries
    .filter((e) => e.userEmail === userEmail)
    .sort(
      (a, b) =>
        new Date(b.finishedAt ?? b.joinedAt) -
        new Date(a.finishedAt ?? a.joinedAt)
    )
    .map((e) => ({
      id: e.id,
      date: (e.finishedAt ?? e.joinedAt).slice(0, 10),
      serviceName: getService(services, e).name,
      outcome:
        e.status === "served"
          ? "Served"
          : e.status === "canceled"
            ? "Canceled"
            : "Waiting",
    }));
}