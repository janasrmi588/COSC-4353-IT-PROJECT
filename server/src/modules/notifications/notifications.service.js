// Notification module, logic: trigger a notification when a user joins a queue and when a user
// is close to being served. Notifications may be logged or returned to the front end (no real email/SMS).
import { notifications } from "../../data/store.js";
export const NOTIFICATION_TYPES = ["status", "queue"];
export const MESSAGE_MAX_LENGTH = 500;
export const EMAIL_MAX_LENGTH = 254;

export const ALMOST_READY_POSITION = 2;

function fail(status, message) {
  return { success: false, status, message };
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function nextNotificationId() {
  return Math.max(0, ...notifications.map((n) => n.id)) + 1;
}

export function createNotification({
  userEmail,
  entryId = null,
  type = "status",
  message,
} = {}) {
  const email = normalizeEmail(userEmail);
  const text = typeof message === "string" ? message.trim() : "";

  if (!email) {
    return fail(400, "A user email is required.");
  }
  if (email.length > EMAIL_MAX_LENGTH) {
    return fail(400, `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`);
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
  if (entryId !== null && !Number.isInteger(entryId)) {
    return fail(400, "entryId must be a whole number or null.");
  }

  const notification = {
    id: nextNotificationId(),
    userEmail: email,
    entryId,
    type,
    message: text,
    read: false,
    createdAt: new Date().toISOString(),
  };

  notifications.push(notification);
  console.log(`[notification -> ${email}] ${text}`);

  return { success: true, status: 201, notification };
}

export function notifyJoinedQueue({ userEmail, entryId = null, serviceName }) {
  return createNotification({
    userEmail,
    entryId,
    type: "queue",
    message: `You joined the ${serviceName} queue.`,
  });
}

export function notifyAlmostReady({ userEmail, entryId = null, serviceName }) {
  const email = normalizeEmail(userEmail);
  const message = `You are almost up for ${serviceName}.`;

  const alreadySent = notifications.some(
    (n) =>
      n.userEmail === email &&
      n.type === "status" &&
      n.entryId === entryId &&
      n.message === message,
  );
  if (entryId !== null && alreadySent) {
    return { success: true, status: 200, duplicate: true };
  }

  return createNotification({ userEmail, entryId, type: "status", message });
}

export function listNotifications(userEmail, { unreadOnly = false } = {}) {
  const email = normalizeEmail(userEmail);
  if (!email) {
    return fail(400, "A user email is required.");
  }

  const mine = notifications
    .filter((n) => n.userEmail === email && (!unreadOnly || !n.read))
    .sort((a, b) => {
      const byTime = new Date(b.createdAt) - new Date(a.createdAt);
      return byTime !== 0 ? byTime : b.id - a.id;
    });

  return {
    success: true,
    status: 200,
    notifications: mine,
    unreadCount: mine.filter((n) => !n.read).length,
  };
}

export function markNotificationRead(userEmail, id) {
  const email = normalizeEmail(userEmail);
  if (!email) {
    return fail(400, "A user email is required.");
  }
  if (!Number.isInteger(id) || id < 1) {
    return fail(400, "Notification id must be a positive whole number.");
  }

  const notification = notifications.find(
    (n) => n.id === id && n.userEmail === email,
  );
  if (!notification) {
    return fail(404, "Notification not found.");
  }

  notification.read = true;
  return { success: true, status: 200, notification };
}
