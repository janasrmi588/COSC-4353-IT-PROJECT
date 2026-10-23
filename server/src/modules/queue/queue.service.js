import { queueEntries, services, users } from "../../data/store.js";
import {
  ALMOST_READY_POSITION,
  createNotification,
  notifyAlmostReady,
  notifyJoinedQueue,
} from "../notifications/notifications.service.js";
import { estimateWait } from "../waitTime/waitTime.service.js";

export const ENTRY_STATUSES = ["waiting", "served", "canceled"];

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

function fail(status, message, details) {
  const result = { success: false, status, message };
  if (details) result.details = details;
  return result;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function toPositiveInt(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return Number(value);
  }
  return NaN;
}

// Look up who is calling. `role` is "user" or "administrator".
function checkRole(email, role) {
  const wanted = normalizeEmail(email);
  if (!wanted) {
    return fail(401, "Please log in first.");
  }

  const user = users.find((u) => u.email.toLowerCase() === wanted);
  if (!user) {
    return fail(401, "Please log in first.");
  }

  if (user.role !== role) {
    return fail(
      403,
      role === "administrator"
        ? "Only administrators can manage queues."
        : "Only users can join or leave queues.",
    );
  }

  return { user };
}

function getService(serviceId) {
  return services.find((s) => s.id === serviceId);
}

// ---------- ordering ----------

export function compareEntries(a, b) {
  const byPriority =
    (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
  if (byPriority !== 0) return byPriority;

  const byArrival = new Date(a.joinedAt) - new Date(b.joinedAt);
  if (byArrival !== 0) return byArrival;

  return a.id - b.id;
}

// Everyone currently waiting, in the order they will be served.
// Pass a serviceId to get just that service's line.
export function getWaitingEntries(serviceId = null) {
  return queueEntries
    .filter(
      (e) =>
        e.status === "waiting" && (serviceId === null || e.serviceId === serviceId),
    )
    .sort(compareEntries);
}

// What the front end gets for one waiting entry. `position` is 1-based inside
// that service's line.
function describeEntry(entry, line, index) {
  const service = getService(entry.serviceId);
  const position = index === -1 ? null : index + 1;

  return {
    ...entry,
    serviceName: service ? service.name : "Unknown service",
    position,
    peopleAhead: position === null ? 0 : position - 1,
    estimatedWait: position === null ? 0 : estimateWait(line, index),
  };
}

function nextEntryId() {
  return Math.max(0, ...queueEntries.map((e) => e.id)) + 1;
}

// Tickets look like Q-1042: the service id followed by a counter for that service.
function nextTicketNumber(serviceId) {
  let highest = serviceId * 1000;
  for (const entry of queueEntries) {
    if (entry.serviceId !== serviceId) continue;
    const n = Number(String(entry.ticketNumber).replace(/^Q-/, ""));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `Q-${highest + 1}`;
}

// Anyone now at the front of a line gets a one-time "almost up" notification.
function notifyFrontOfLine(serviceId) {
  const service = getService(serviceId);
  if (!service) return;

  getWaitingEntries(serviceId)
    .slice(0, ALMOST_READY_POSITION)
    .forEach((entry) => {
      notifyAlmostReady({
        userEmail: entry.userEmail,
        entryId: entry.id,
        serviceName: service.name,
      });
    });
}

// ---------- users: join / leave / see my queues ----------

export function joinQueue(userEmail, body) {
  const denied = checkRole(userEmail, "user");
  if (denied.success === false) return denied;

  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const serviceId = toPositiveInt(data.serviceId);
  if (Number.isNaN(serviceId)) {
    return fail(400, "Please choose a service.", {
      serviceId: "A service is required.",
    });
  }

  const service = getService(serviceId);
  if (!service) {
    return fail(404, "Service not found.");
  }
  if (!service.isOpen) {
    return fail(409, `${service.name} is closed right now.`);
  }

  const email = normalizeEmail(userEmail);
  const alreadyWaiting = queueEntries.some(
    (e) =>
      e.status === "waiting" &&
      e.serviceId === serviceId &&
      e.userEmail === email,
  );
  if (alreadyWaiting) {
    return fail(409, `You are already in the ${service.name} queue.`);
  }

  const entry = {
    id: nextEntryId(),
    ticketNumber: nextTicketNumber(serviceId),
    serviceId,
    userEmail: email,
    status: "waiting",
    priority: service.priority,
    joinedAt: new Date().toISOString(),
    finishedAt: null,
  };
  queueEntries.push(entry);

  notifyJoinedQueue({
    userEmail: email,
    entryId: entry.id,
    serviceName: service.name,
  });

  // Someone who joins straight into the first spots is already almost up.
  notifyFrontOfLine(serviceId);

  const line = getWaitingEntries(serviceId);
  const index = line.findIndex((e) => e.id === entry.id);

  return { success: true, status: 201, entry: describeEntry(entry, line, index) };
}

export function leaveQueue(userEmail, entryId) {
  const denied = checkRole(userEmail, "user");
  if (denied.success === false) return denied;

  const id = toPositiveInt(entryId);
  if (Number.isNaN(id)) {
    return fail(400, "Queue entry id must be a positive whole number.");
  }

  const email = normalizeEmail(userEmail);
  const entry = queueEntries.find((e) => e.id === id && e.userEmail === email);
  if (!entry) {
    return fail(404, "Queue entry not found.");
  }
  if (entry.status !== "waiting") {
    return fail(409, "You are no longer waiting in this queue.");
  }

  entry.status = "canceled";
  entry.finishedAt = new Date().toISOString();

  // People behind the one who left may have moved up.
  notifyFrontOfLine(entry.serviceId);

  return { success: true, status: 200, entry: describeEntry(entry, [], -1) };
}

// The queues this user is currently waiting in, with position and wait.
export function listMyQueues(userEmail) {
  const denied = checkRole(userEmail, "user");
  if (denied.success === false) return denied;

  const email = normalizeEmail(userEmail);
  const entries = [];

  for (const service of services) {
    const line = getWaitingEntries(service.id);
    line.forEach((entry, index) => {
      if (entry.userEmail === email) {
        entries.push(describeEntry(entry, line, index));
      }
    });
  }

  entries.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  return { success: true, status: 200, entries };
}

// ---------- administrators: view / serve next ----------

// Current queue. With a serviceId it is that service's line; without one it is
// every waiting user in one list (priority first, then arrival).
export function viewQueue(adminEmail, serviceIdInput) {
  const denied = checkRole(adminEmail, "administrator");
  if (denied.success === false) return denied;

  let serviceId = null;
  if (serviceIdInput !== undefined && serviceIdInput !== "") {
    serviceId = toPositiveInt(serviceIdInput);
    if (Number.isNaN(serviceId)) {
      return fail(400, "Service id must be a positive whole number.");
    }
    if (!getService(serviceId)) {
      return fail(404, "Service not found.");
    }
  }

  const line = getWaitingEntries(serviceId);
  const queue = line.map((entry, index) => ({
    ...describeEntry(entry, line, index),
  }));

  return { success: true, status: 200, serviceId, queue };
}

// Serve the user at the front of the line. Without a serviceId, serves the
// front of the combined queue (highest priority, then longest waiting).
export function serveNext(adminEmail, body) {
  const denied = checkRole(adminEmail, "administrator");
  if (denied.success === false) return denied;

  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  let serviceId = null;
  if (
    data.serviceId !== undefined &&
    data.serviceId !== null &&
    data.serviceId !== ""
  ) {
    serviceId = toPositiveInt(data.serviceId);
    if (Number.isNaN(serviceId)) {
      return fail(400, "Service id must be a positive whole number.");
    }
    if (!getService(serviceId)) {
      return fail(404, "Service not found.");
    }
  }

  const [next] = getWaitingEntries(serviceId);
  if (!next) {
    return fail(404, "Nobody is waiting in this queue.");
  }

  next.status = "served";
  next.finishedAt = new Date().toISOString();
  next.servedBy = normalizeEmail(adminEmail);

  const service = getService(next.serviceId);
  const serviceName = service ? service.name : "your service";

  createNotification({
    userEmail: next.userEmail,
    entryId: next.id,
    type: "status",
    message: `It's your turn for ${serviceName}. Please head to the help desk.`,
  });
  notifyFrontOfLine(next.serviceId);

  return { success: true, status: 200, entry: describeEntry(next, [], -1) };
}

