import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes.js";

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

  return app;
}