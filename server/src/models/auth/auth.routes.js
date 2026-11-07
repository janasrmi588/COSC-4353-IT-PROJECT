import express from "express";

import {
  registerUser,
  loginUser,
} from "./auth.service.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const result = await registerUser(email, password);

    if (!result.success) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    return res.status(201).json({
      message: "Registration successful.",
      user: result.user,
    });
  } catch (error) {
    console.error("Registration failed:", error.message);

    return res.status(500).json({
      message: "Unable to register. Please try again.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const result = await loginUser(email, password);

    if (!result.success) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    return res.status(200).json({
      message: "Login successful.",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      message: "Unable to log in. Please try again.",
    });
  }
});

export default router;