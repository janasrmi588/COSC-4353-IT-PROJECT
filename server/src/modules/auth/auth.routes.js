import express from "express";
import {
  registerUser,
  loginUser,
} from "./auth.service.js";

const router = express.Router();

router.post("/register", (req, res) => {
  const { email, password } = req.body;

  const result = registerUser(email, password);

  if (!result.success) {
    return res.status(result.status).json({
      message: result.message,
    });
  }

  return res.status(result.status).json({
    message: "Registration successful.",
    user: result.user,
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const result = loginUser(email, password);

  if (!result.success) {
    return res.status(result.status).json({
      message: result.message,
    });
  }

  return res.status(result.status).json({
    message: "Login successful.",
    user: result.user,
  });
});

export default router;