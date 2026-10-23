import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes.js";
import notificationRoutes from "./modules/notifications/notifications.routes.js";
import serviceRoutes from "./modules/services/services.routes.js";
import queueRoutes from "./modules/queue/queue.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
    });
  });

  // Authentication routes
  app.use("/api/auth", authRoutes);

  // Notification routes
  app.use("/api/notifications", notificationRoutes);

  // Service management routes
  app.use("/api/services", serviceRoutes);

  // Queue management routes
  app.use("/api/queue", queueRoutes);

  return app;
}
