import express from "express";
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

router.get("/", (req, res) => {
  const result = listServices();
  return sendResult(res, result, (r) => ({ services: r.services }));
});

router.post("/", (req, res) => {
  const result = createService(req.query.email, req.body);
  return sendResult(res, result, (r) => ({
    message: "Service created.",
    service: r.service,
  }));
});

router.put("/:id", (req, res) => {
  const id = /^[1-9]\d*$/.test(req.params.id) ? Number(req.params.id) : NaN;

  const result = updateService(req.query.email, id, req.body);
  return sendResult(res, result, (r) => ({
    message: "Service updated.",
    service: r.service,
  }));
});

router.delete("/:id", (req, res) => {
  const id = /^[1-9]\d*$/.test(req.params.id) ? Number(req.params.id) : NaN;

  const result = deleteService(req.query.email, id);
  return sendResult(res, result, (r) => ({
    message: "Service deleted.",
    service: r.service,
  }));
});

export default router;
