// History module, routes: a user's queue participation history.
import express from "express";
import { listHistory } from "./history.service.js";

const router = express.Router();

router.get("/", (req, res) => {
    const result = listHistory(req.query.email);

    if (!result.success) {
        return res.status(result.status).json({ message: result.message });
    }
    return res.status(result.status).json({ history: result.history });
});

export default router;
