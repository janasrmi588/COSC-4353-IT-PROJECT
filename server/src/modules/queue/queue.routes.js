import express from "express";
import {
  joinQueue,
  leaveQueue,
  listMyQueues,
  serveNext,
  viewQueue,
} from "./queue.service.js";

const router = express.Router();

function sendResult(res, result, successBody) {
  if (!result.success) {
    const body = { message: result.message };
    if (result.details) body.details = result.details;
    return res.status(result.status).json(body);
  }
  return res.status(result.status).json(successBody(result));
}

router.get("/mine", (req, res) => {
  const result = listMyQueues(req.query.email);
  return sendResult(res, result, (r) => ({ entries: r.entries }));
});

router.post("/join", (req, res) => {
  const result = joinQueue(req.query.email, req.body);
  return sendResult(res, result, (r) => ({
    message: "You joined the queue.",
    entry: r.entry,
  }));
});

router.post("/serve-next", (req, res) => {
  const result = serveNext(req.query.email, req.body);
  return sendResult(res, result, (r) => ({
    message: "Next user served.",
    entry: r.entry,
  }));
});

router.post("/:id/leave", (req, res) => {
  const result = leaveQueue(req.query.email, req.params.id);
  return sendResult(res, result, (r) => ({
    message: "You left the queue.",
    entry: r.entry,
  }));
});

router.get("/", (req, res) => {
  const result = viewQueue(req.query.email, req.query.serviceId);
  return sendResult(res, result, (r) => ({
    serviceId: r.serviceId,
    queue: r.queue,
  }));
});

export default router;
