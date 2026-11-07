import express from "express";
import { listHistory } from "./history.service.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const result = await listHistory(req.user.email);

    if (!result.success) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    return res.status(200).json({
      history: result.history,
    });
  } catch (error) {
    next(error);
  }
});

export default router;