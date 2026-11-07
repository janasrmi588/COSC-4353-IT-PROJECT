import express from "express";
import mongoose from "mongoose";
import {
  createService,
  deleteService,
  listServices,
  updateService,
} from "./services.service.js";

const router = express.Router();

function sendResult(res, result, successBody) {
  if (!result.success) {
    const body = { message: result.message };
    if (result.details) body.details = result.details;
    return res.status(result.status).json(body);
  }
  return res.status(result.status).json(successBody(result));
}

function badId(req, res) {
  if (mongoose.isValidObjectId(req.params.id)) return false;
  res.status(400).json({ message: "Service id is not valid." });
  return true;
}

router.get("/", async (req, res) => {
  const result = await listServices();
  return sendResult(res, result, (r) => ({ services: r.services }));
});

router.post("/", async (req, res) => {
  const result = await createService(req.user.email, req.body);
  return sendResult(res, result, (r) => ({
    message: "Service created.",
    service: r.service,
  }));
});

router.put("/:id", async (req, res) => {
  if (badId(req, res)) return;
  const result = await updateService(req.user.email, req.params.id, req.body);
  return sendResult(res, result, (r) => ({
    message: "Service updated.",
    service: r.service,
  }));
});

router.delete("/:id", async (req, res) => {
  if (badId(req, res)) return;
  const result = await deleteService(req.user.email, req.params.id);
  return sendResult(res, result, (r) => ({
    message: "Service deleted.",
    service: r.service,
  }));
});

export default router;
