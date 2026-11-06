import mongoose from "mongoose";
import Notification, {
  MESSAGE_MAX_LENGTH,
  NOTIFICATION_TYPES,
} from "../../models/Notification.js";

export { MESSAGE_MAX_LENGTH, NOTIFICATION_TYPES };
export const EMAIL_MAX_LENGTH = 254;

export const ALMOST_READY_POSITION = 2;

function isValidId(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
}

function requireModel(name) {
  const model = mongoose.models[name];
  if (!model) {
    throw new Error(
      `The ${name} model is not registered. Import its model file before handling requests.`,
    );
  }
  return model;
}

async function findUserByEmail(email) {
  const wanted = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!wanted) return null;

  return requireModel("UserCredentials")
    .findOne({ email: wanted })
    .select("_id email role")
    .lean();
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function fail(status, message) {
  return { success: false, status, message };
}

function idText(value) {
  return value === null || value === undefined ? value : String(value);
}

export function toApiNotification(doc) {
  return {
    id: String(doc._id),
    entryId: doc.entryId ? String(doc.entryId) : null,
    type: doc.type,
    message: doc.message,
    read: doc.status === "viewed",
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function createNotification({
  userId,
  entryId = null,
  type = "status",
  message,
} = {}) {
  const user = idText(userId);
  const entry = idText(entryId);
  const text = typeof message === "string" ? message.trim() : "";

  if (!user) {
    return fail(400, "A user is required.");
  }
  if (!isValidId(user)) {
    return fail(400, "userId is not a valid id.");
  }
  if (typeof message !== "string" || !text) {
    return fail(400, "A notification message is required.");
  }
  if (text.length > MESSAGE_MAX_LENGTH) {
    return fail(
      400,
      `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer.`,
    );
  }
  if (!NOTIFICATION_TYPES.includes(type)) {
    return fail(400, `Type must be one of: ${NOTIFICATION_TYPES.join(", ")}.`);
  }
  if (entry !== null && entry !== undefined && !isValidId(entry)) {
    return fail(400, "entryId must be a valid id or null.");
  }

  try {
    const doc = await Notification.create({
      userId: user,
      entryId: entry ?? null,
      type,
      message: text,
    });
    console.log(`[notification -> ${user}] ${text}`);

    return { success: true, status: 201, notification: toApiNotification(doc) };
  } catch (error) {
    console.error("[notifications] could not save a notification:", error);
    return fail(500, "Could not save the notification.");
  }
}

export function notifyJoinedQueue({ userId, entryId = null, serviceName }) {
  return createNotification({
    userId,
    entryId,
    type: "queue",
    message: `You joined the ${serviceName} queue.`,
  });
}

export async function notifyAlmostReady({
  userId,
  entryId = null,
  serviceName,
}) {
  const message = `You are almost up for ${serviceName}.`;
  const user = idText(userId);
  const entry = idText(entryId);

  if (entry && isValidId(user) && isValidId(entry)) {
    try {
      const alreadySent = await Notification.exists({
        userId: user,
        type: "status",
        entryId: entry,
        message,
      });
      if (alreadySent) {
        return { success: true, status: 200, duplicate: true };
      }
    } catch (error) {
      console.error("[notifications] could not check for a duplicate:", error);
      return fail(500, "Could not save the notification.");
    }
  }

  return createNotification({ userId, entryId, type: "status", message });
}

export async function listNotifications(
  userEmail,
  { unreadOnly = false } = {},
) {
  const email = normalizeEmail(userEmail);
  if (!email) {
    return fail(400, "A user email is required.");
  }
  if (email.length > EMAIL_MAX_LENGTH) {
    return fail(400, `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`);
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return { success: true, status: 200, notifications: [], unreadCount: 0 };
  }

  const filter = { userId: user._id };
  if (unreadOnly) filter.status = "sent";

  const docs = await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  const notifications = docs.map(toApiNotification);

  return {
    success: true,
    status: 200,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
}

export async function markNotificationRead(userEmail, id) {
  const email = normalizeEmail(userEmail);
  if (!email) {
    return fail(400, "A user email is required.");
  }
  if (!isValidId(id)) {
    return fail(400, "Notification id is not valid.");
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return fail(404, "Notification not found.");
  }

  const doc = await Notification.findOneAndUpdate(
    { _id: id, userId: user._id },
    { status: "viewed" },
    { returnDocument: "after" },
  ).lean();
  if (!doc) {
    return fail(404, "Notification not found.");
  }

  return { success: true, status: 200, notification: toApiNotification(doc) };
}
