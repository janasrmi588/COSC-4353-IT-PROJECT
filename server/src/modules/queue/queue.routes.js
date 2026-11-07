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

// Express 5 passes a rejected promise from an async handler to the error handler.

router.get("/mine", async (req, res) => {
  const result = await listMyQueues(req.user.email);
  return sendResult(res, result, (r) => ({ entries: r.entries }));
});

router.post("/join", async (req, res) => {
  const result = await joinQueue(req.user.email, req.body);
  return sendResult(res, result, (r) => ({
    message: "You joined the queue.",
    entry: r.entry,
  }));
});

router.post("/serve-next", async (req, res) => {
  const result = await serveNext(req.user.email, req.body);
  return sendResult(res, result, (r) => ({
    message: "Next user served.",
    entry: r.entry,
  }));
});

// The service checks that :id is a valid ObjectId and answers 400 if not.
router.post("/:id/leave", async (req, res) => {
  const result = await leaveQueue(req.user.email, req.params.id);
  return sendResult(res, result, (r) => ({
    message: "You left the queue.",
    entry: r.entry,
  }));
});

router.get("/", async (req, res) => {
  const result = await viewQueue(req.user.email, req.query.serviceId);
  return sendResult(res, result, (r) => ({
    serviceId: r.serviceId,
    queue: r.queue,
  }));
});

export default router;

