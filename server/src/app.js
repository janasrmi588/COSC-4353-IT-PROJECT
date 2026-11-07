import express from "express";
import cors from "cors";

import { requireAuth } from "./modules/auth/auth.middleware.js";

import authRoutes from "./modules/auth/auth.routes.js";
import notificationRoutes from "./modules/notifications/notifications.routes.js";
import serviceRoutes from "./modules/services/services.routes.js";
import queueRoutes from "./modules/queue/queue.routes.js";
import historyRoutes from "./modules/history/history.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);

  app.use("/api/notifications", requireAuth, notificationRoutes);
  app.use("/api/services", requireAuth, serviceRoutes);
  app.use("/api/queue", requireAuth, queueRoutes);
  app.use("/api/history", requireAuth, historyRoutes);

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    console.error(error.message);

    const status = error.status || 500;

    res.status(status).json({
      message:
        status >= 500
          ? "A server error occurred. Please try again."
          : error.message,
    });
  });

  return app;
}