import Queue from "../../models/Queue.js";
import QueueEntry from "../../models/QueueEntry.js";
import Service from "../../models/Service.js";
import UserCredentials from "../../models/UserCredentials.js";
import {
  ALMOST_READY_POSITION,
  createNotification,
  notifyAlmostReady,
  notifyJoinedQueue,
} from "../notifications/notifications.service.js";
import { estimateWait } from "../waitTime/waitTime.service.js";

export const ENTRY_STATUSES = ["waiting", "served", "canceled"];
export const TITLE_MAX_LENGTH = 150;
export const DESCRIPTION_MAX_LENGTH = 2000;

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

// How many times serveNext retries after losing a race to another admin.
const MAX_SERVE_ATTEMPTS = 5;

const BAD_SERVICE_ID = "Service id is not valid.";
const BAD_ENTRY_ID = "Queue entry id is not valid.";

function fail(status, message, details) {
  const result = { success: false, status, message };
  if (details) result.details = details;
  return result;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Ids are Mongo ObjectIds now: exactly 24 hex characters, sent as text.
function isValidId(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
}

// Small private lookup (same as the one in services.service.js).
// TODO: swap for Joice's findUserByEmail once it is merged.
async function findUserByEmail(email) {
  const wanted = normalizeEmail(email);
  if (!wanted) return null;

  return UserCredentials.findOne({ email: wanted })
    .select("_id email role")
    .lean();
}

// Look up who is calling. `role` is "user" or "administrator".
async function checkRole(email, role) {
  if (!normalizeEmail(email)) {
    return fail(401, "Please log in first.");
  }

  const user = await findUserByEmail(email);
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

// ---------- ordering ----------

function compareIds(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const x = String(a);
  const y = String(b);
  if (x < y) return -1;
  return x > y ? 1 : 0;
}

// Priority (high, medium, low), then sortOrder, then arrival, then id.
export function compareEntries(a, b) {
  const byPriority =
    (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
  if (byPriority !== 0) return byPriority;

  if (Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder)) {
    const bySortOrder = a.sortOrder - b.sortOrder;
    if (bySortOrder !== 0) return bySortOrder;
  }

  const byArrival = new Date(a.joinedAt) - new Date(b.joinedAt);
  if (byArrival !== 0) return byArrival;

  return compareIds(a.id, b.id);
}

// Plain-object copy of a QueueEntry with string ids. `userId` stays on it for
// notifications and is removed again in describeEntry.
function toEntryView(doc) {
  return {
    id: String(doc._id),
    ticketNumber: doc.ticketNumber,
    serviceId: String(doc.serviceId),
    serviceName: doc.serviceName,
    userId: String(doc.userId),
    userEmail: doc.userEmail,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    priority: doc.priority,
    sortOrder: doc.sortOrder,
    joinedAt: new Date(doc.joinedAt).toISOString(),
    finishedAt: doc.finishedAt ? new Date(doc.finishedAt).toISOString() : null,
  };
}

// Everyone currently waiting, in the order they will be served.
// Pass a serviceId to get just that service's line.
export async function getWaitingEntries(serviceId = null) {
  const filter = { status: "waiting" };
  if (serviceId !== null) filter.serviceId = serviceId;

  const docs = await QueueEntry.find(filter).lean();
  return docs.map(toEntryView).sort(compareEntries);
}

// The { id, expectedDuration } list estimateWait needs for these entries.
async function loadServiceList(line) {
  const ids = [...new Set(line.map((entry) => entry.serviceId))];
  if (ids.length === 0) return [];

  const docs = await Service.find({ _id: { $in: ids } })
    .select("expectedDuration")
    .lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    expectedDuration: doc.expectedDuration,
  }));
}

// What the front end gets for one entry. `position` is 1-based inside `line`.
// Pass index -1 for entries that are no longer waiting.
function describeEntry(entry, line, index, serviceList = []) {
  const { userId, ...rest } = entry;
  const position = index === -1 ? null : index + 1;

  return {
    ...rest,
    position,
    peopleAhead: position === null ? 0 : position - 1,
    estimatedWait:
      position === null ? 0 : estimateWait(line, index, serviceList),
  };
}

// Anyone now at the front of a line gets a one-time "almost up" notification.
async function notifyFrontOfLine(line) {
  for (const entry of line.slice(0, ALMOST_READY_POSITION)) {
    await notifyAlmostReady({
      userId: entry.userId,
      entryId: entry.id,
      serviceName: entry.serviceName,
    });
  }
}

// ---------- input checks ----------

function checkText(errors, field, label, value, maxLength) {
  if (value === undefined || value === null) {
    errors[field] = `${label} is required.`;
    return null;
  }
  if (typeof value !== "string") {
    errors[field] = `${label} must be text.`;
    return null;
  }

  const text = value.trim();
  if (!text) {
    errors[field] = `${label} is required.`;
  } else if (text.length > maxLength) {
    errors[field] = `${label} must be ${maxLength} characters or fewer.`;
  }
  return text;
}

// Reads the optional serviceId filter used by the administrator calls.
// Returns { serviceId } (null for "all services") or { error }.
async function readServiceFilter(input) {
  if (input === undefined || input === null || input === "") {
    return { serviceId: null };
  }
  if (!isValidId(input)) {
    return { error: fail(400, BAD_SERVICE_ID) };
  }
  if (!(await Service.exists({ _id: input }))) {
    return { error: fail(404, "Service not found.") };
  }
  return { serviceId: input };
}

// ---------- users: join / leave / see my queues ----------

export async function joinQueue(userEmail, body) {
  const denied = await checkRole(userEmail, "user");
  if (denied.success === false) return denied;
  const { user } = denied;

  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const errors = {};
  if (!isValidId(data.serviceId)) {
    errors.serviceId = "A service is required.";
  }
  const title = checkText(errors, "title", "Title", data.title, TITLE_MAX_LENGTH);
  const description = checkText(
    errors,
    "description",
    "Description",
    data.description,
    DESCRIPTION_MAX_LENGTH,
  );
  if (Object.keys(errors).length > 0) {
    const onlyService =
      Object.keys(errors).length === 1 && errors.serviceId !== undefined;
    return fail(
      400,
      onlyService ? "Please choose a service." : "Please fix the highlighted fields.",
      errors,
    );
  }

  const service = await Service.findById(data.serviceId).lean();
  if (!service) {
    return fail(404, "Service not found.");
  }

  const queue = await Queue.findOne({ serviceId: service._id }).lean();
  if (!queue || queue.status !== "open") {
    return fail(409, `${service.name} is closed right now.`);
  }

  const alreadyInQueue = () =>
    fail(409, `You are already in the ${service.name} queue.`);

  // Checked up front so a repeat click does not use up a ticket number. The
  // partial unique index below is what actually enforces it.
  if (
    await QueueEntry.exists({
      userId: user._id,
      queueId: queue._id,
      status: "waiting",
    })
  ) {
    return alreadyInQueue();
  }

  // Atomic, so two people joining at once never get the same number. The
  // status filter also catches a queue that was closed a moment ago.
  const counted = await Queue.findOneAndUpdate(
    { _id: queue._id, status: "open" },
    { $inc: { ticketCounter: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!counted) {
    return fail(409, `${service.name} is closed right now.`);
  }

  let doc;
  try {
    doc = await QueueEntry.create({
      userId: user._id,
      userEmail: normalizeEmail(userEmail),
      queueId: queue._id,
      serviceId: service._id,
      serviceName: service.name,
      priority: service.priority,
      title,
      description,
      ticketNumber: `Q-${counted.ticketCounter}`,
    });
  } catch (error) {
    // Two joins from the same user at the same moment: the partial unique
    // index lets only one through.
    if (error?.code === 11000 && !error.keyPattern?.ticketNumber) {
      return alreadyInQueue();
    }
    throw error;
  }

  const entry = toEntryView(doc.toObject());

  await notifyJoinedQueue({
    userId: entry.userId,
    entryId: entry.id,
    serviceName: entry.serviceName,
  });

  const line = await getWaitingEntries(entry.serviceId);
  // Someone who joins straight into the first spots is already almost up.
  await notifyFrontOfLine(line);

  const index = line.findIndex((e) => e.id === entry.id);
  const serviceList = await loadServiceList(line);

  return {
    success: true,
    status: 201,
    entry: describeEntry(entry, line, index, serviceList),
  };
}

export async function leaveQueue(userEmail, entryId) {
  const denied = await checkRole(userEmail, "user");
  if (denied.success === false) return denied;
  const { user } = denied;

  if (!isValidId(entryId)) {
    return fail(400, BAD_ENTRY_ID);
  }

  // One atomic update, so leaving twice cannot cancel the entry twice.
  const doc = await QueueEntry.findOneAndUpdate(
    { _id: entryId, userId: user._id, status: "waiting" },
    { status: "canceled", finishedAt: new Date() },
    { returnDocument: "after" },
  ).lean();

  if (!doc) {
    const theirs = await QueueEntry.exists({ _id: entryId, userId: user._id });
    return theirs
      ? fail(409, "You are no longer waiting in this queue.")
      : fail(404, "Queue entry not found.");
  }

  const entry = toEntryView(doc);

  // People behind the one who left may have moved up.
  await notifyFrontOfLine(await getWaitingEntries(entry.serviceId));

  return { success: true, status: 200, entry: describeEntry(entry, [], -1) };
}

// The queues this user is currently waiting in, with position and wait.
export async function listMyQueues(userEmail) {
  const denied = await checkRole(userEmail, "user");
  if (denied.success === false) return denied;
  const { user } = denied;

  const mine = await QueueEntry.find({
    userId: user._id,
    status: "waiting",
  }).lean();
  const serviceIds = [...new Set(mine.map((e) => String(e.serviceId)))];

  const entries = [];
  for (const serviceId of serviceIds) {
    const line = await getWaitingEntries(serviceId);
    const serviceList = await loadServiceList(line);

    line.forEach((entry, index) => {
      if (entry.userId === String(user._id)) {
        entries.push(describeEntry(entry, line, index, serviceList));
      }
    });
  }

  entries.sort(
    (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt) || compareIds(a.id, b.id),
  );
  return { success: true, status: 200, entries };
}

// ---------- administrators: view / serve next ----------

// Current queue. With a serviceId it is that service's line; without one it is
// every waiting user in one list (priority first, then arrival).
export async function viewQueue(adminEmail, serviceIdInput) {
  const denied = await checkRole(adminEmail, "administrator");
  if (denied.success === false) return denied;

  const { serviceId, error } = await readServiceFilter(serviceIdInput);
  if (error) return error;

  const line = await getWaitingEntries(serviceId);
  const serviceList = await loadServiceList(line);
  const queue = line.map((entry, index) =>
    describeEntry(entry, line, index, serviceList),
  );

  return { success: true, status: 200, serviceId, queue };
}

// Serve the user at the front of the line. Without a serviceId, serves the
// front of the combined queue (highest priority, then longest waiting).
export async function serveNext(adminEmail, body) {
  const denied = await checkRole(adminEmail, "administrator");
  if (denied.success === false) return denied;
  const { user: admin } = denied;

  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const { serviceId, error } = await readServiceFilter(data.serviceId);
  if (error) return error;

  // Two admins can pick the same person at the same moment. Whoever's update
  // still finds the entry "waiting" wins; the other moves on to the next one.
  let claimed = null;
  for (let attempt = 0; attempt < MAX_SERVE_ATTEMPTS && !claimed; attempt++) {
    const line = await getWaitingEntries(serviceId);
    if (line.length === 0) {
      return fail(404, "Nobody is waiting in this queue.");
    }

    for (const candidate of line) {
      claimed = await QueueEntry.findOneAndUpdate(
        { _id: candidate.id, status: "waiting" },
        { status: "served", finishedAt: new Date(), servedBy: admin._id },
        { returnDocument: "after" },
      ).lean();
      if (claimed) break;
    }
  }

  if (!claimed) {
    return fail(409, "The queue is busy. Please try again.");
  }

  const entry = toEntryView(claimed);

  await createNotification({
    userId: entry.userId,
    entryId: entry.id,
    type: "status",
    message: `It's your turn for ${entry.serviceName}. Please head to the help desk.`,
  });
  await notifyFrontOfLine(await getWaitingEntries(entry.serviceId));

  return { success: true, status: 200, entry: describeEntry(entry, [], -1) };
}
