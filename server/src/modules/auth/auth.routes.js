import express from "express";

import Session from "../../models/Session.js";

import {
  registerUser,
  loginUser,
  publicUser,
} from "./auth.service.js";

import { requireAuth } from "./auth.middleware.js";

const router = express.Router();

// Register a regular user.
router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    const result = await registerUser(email, password);

    if (!result.success) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    return res.status(result.status).json({
      message: "Registration successful.",
      user: result.user,
    });
  } catch (error) {
    return next(error);
  }
});

// Log in and return the session token.
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    const result = await loginUser(email, password);

    if (!result.success) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    return res.status(result.status).json({
      message: "Login successful.",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    return next(error);
  }
});

// Verify the current session.
router.get("/me", requireAuth, (req, res) => {
  return res.json({
    user: publicUser(req.user),
  });
});

// Revoke the current session.
router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await Session.deleteOne({
      _id: req.sessionId,
    });

    return res.json({
      message: "Logged out successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;