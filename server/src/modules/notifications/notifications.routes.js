// Notification module, routes (only needed if the front end fetches notifications from the back end).
import express from "express";
import {
  listNotifications,
  markNotificationRead,
} from "./notifications.service.js";

// Mounted at /api/notifications (see app.js)
//   GET   /?email=<email>[&unread=true]    the user's notifications, newest first
//   PATCH /:id/read?email=<email>          mark one of the user's notifications as read
//
// Login does not hand out a token yet, so the front end sends the signed-in
// user's email (it gets it from the login response). When real sessions are
// added, read the email from the session here instead of the query string.
//
// Notifications are CREATED by other modules calling createNotification() in
// notifications.service.js, so there is no POST route.

const router = express.Router();

router.get("/", (req, res) => {
  const result = listNotifications(req.query.email, {
    unreadOnly: req.query.unread === "true",
  });

  if (!result.success) {
    return res.status(result.status).json({ message: result.message });
  }

  return res.status(result.status).json({
    notifications: result.notifications,
    unreadCount: result.unreadCount,
  });
});

router.patch("/:id/read", (req, res) => {
  // "12" -> 12. Anything else ("abc", "1.5", "0") becomes NaN and is rejected by the service.
  const id = /^[1-9]\d*$/.test(req.params.id) ? Number(req.params.id) : NaN;

  const result = markNotificationRead(req.query.email, id);

  if (!result.success) {
    return res.status(result.status).json({ message: result.message });
  }

  return res.status(result.status).json({
    message: "Notification marked as read.",
    notification: result.notification,
  });
});

export default router;
