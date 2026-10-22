// Notification module, routes (only needed if the front end fetches notifications from the back end).
import express from "express";
import {
  listNotifications,
  markNotificationRead,
} from "./notifications.service.js";

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
