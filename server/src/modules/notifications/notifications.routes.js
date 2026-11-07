// Notification module, routes (only needed if the front end fetches notifications from the back end).
import express from "express";
import mongoose from "mongoose";
import {
  listNotifications,
  markNotificationRead,
} from "./notifications.service.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const result = await listNotifications(req.user.email, {
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

router.patch("/:id/read", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Notification id is not valid." });
  }

  const result = await markNotificationRead(req.user.email, req.params.id);

  if (!result.success) {
    return res.status(result.status).json({ message: result.message });
  }

  return res.status(result.status).json({
    message: "Notification marked as read.",
    notification: result.notification,
  });
});

export default router;
