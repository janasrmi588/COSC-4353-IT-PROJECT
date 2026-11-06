import mongoose from "mongoose";
import Service, {
  DESCRIPTION_MAX_LENGTH,
  DURATION_MAX,
  DURATION_MIN,
  NAME_MAX_LENGTH,
  PRIORITY_LEVELS,
} from "../../models/Service.js";

export {
  DESCRIPTION_MAX_LENGTH,
  DURATION_MAX,
  DURATION_MIN,
  NAME_MAX_LENGTH,
  PRIORITY_LEVELS,
};

function isValidId(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
}

function requireModel(name) {
  const model = mongoose.models[name];
  if (!model) {
    throw new Error(
      `The ${name} model is not registered. Import its model file before handling requests.`,
    );
  }
  return model;
}

async function findUserByEmail(email) {
  const wanted = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!wanted) return null;

  return requireModel("UserCredentials")
    .findOne({ email: wanted })
    .select("_id email role")
    .lean();
}

const DUPLICATE_NAME = "A service with this name already exists.";
const BAD_ID = "Service id is not valid.";

function fail(status, message, details) {
  const result = { success: false, status, message };
  if (details) result.details = details;
  return result;
}

function duplicateName() {
  return fail(409, DUPLICATE_NAME, { name: DUPLICATE_NAME });
}

export function toApiService(doc, queueStatus) {
  return { ...doc.toJSON(), isOpen: queueStatus === "open" };
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function validationDetails(error) {
  if (error?.name !== "ValidationError") return null;

  const details = {};
  for (const [path, problem] of Object.entries(error.errors)) {
    details[path] = problem.message;
  }
  return details;
}

async function checkAdministrator(email) {
  if (typeof email !== "string" || !email.trim()) {
    return fail(401, "Please log in as an administrator.");
  }

  const user = await findUserByEmail(email);
  if (!user || String(user.role).toLowerCase() !== "administrator") {
    return fail(403, "Only administrators can manage services.");
  }
  return null;
}

export function validateServiceInput(body) {
  const errors = {};
  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (
    typeof data.name !== "string" &&
    data.name !== undefined &&
    data.name !== null
  ) {
    errors.name = "Service name must be text.";
  } else if (!name) {
    errors.name = "Service name is required.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Service name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  if (
    typeof data.description !== "string" &&
    data.description !== undefined &&
    data.description !== null
  ) {
    errors.description = "Description must be text.";
  } else if (!description) {
    errors.description = "Description is required.";
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  const duration = data.expectedDuration;
  if (duration === undefined || duration === null || duration === "") {
    errors.expectedDuration = "Expected duration is required.";
  } else if (!Number.isInteger(duration)) {
    errors.expectedDuration =
      "Expected duration must be a whole number of minutes.";
  } else if (duration < DURATION_MIN || duration > DURATION_MAX) {
    errors.expectedDuration = `Expected duration must be between ${DURATION_MIN} and ${DURATION_MAX} minutes.`;
  }

  if (
    data.priority === undefined ||
    data.priority === null ||
    data.priority === ""
  ) {
    errors.priority = "Priority level is required.";
  } else if (!PRIORITY_LEVELS.includes(data.priority)) {
    errors.priority = `Priority level must be one of: ${PRIORITY_LEVELS.join(", ")}.`;
  }

  if (
    data.isOpen !== undefined &&
    data.isOpen !== null &&
    typeof data.isOpen !== "boolean"
  ) {
    errors.isOpen = "Open status must be true or false.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      name,
      description,
      expectedDuration: duration,
      priority: data.priority,
      isOpen: typeof data.isOpen === "boolean" ? data.isOpen : undefined,
    },
  };
}

export async function listServices() {
  const docs = await Service.find().sort({ _id: 1 });
  const queues = await requireModel("Queue")
    .find({ serviceId: { $in: docs.map((d) => d._id) } })
    .lean();

  const statusByService = new Map(
    queues.map((q) => [String(q.serviceId), q.status]),
  );

  return {
    success: true,
    status: 200,
    services: docs.map((d) =>
      toApiService(d, statusByService.get(String(d._id))),
    ),
  };
}

export async function getServiceById(id) {
  if (!isValidId(id)) {
    return fail(400, BAD_ID);
  }

  const doc = await Service.findById(id);
  if (!doc) {
    return fail(404, "Service not found.");
  }

  const queue = await requireModel("Queue")
    .findOne({ serviceId: doc._id })
    .lean();
  return {
    success: true,
    status: 200,
    service: toApiService(doc, queue?.status),
  };
}

export async function createService(adminEmail, body) {
  const denied = await checkAdministrator(adminEmail);
  if (denied) return denied;

  const { errors, values } = validateServiceInput(body);
  if (errors) {
    return fail(400, "Please fix the highlighted fields.", errors);
  }

  const Queue = requireModel("Queue");
  let service;
  try {
    service = await Service.create({
      name: values.name,
      description: values.description,
      expectedDuration: values.expectedDuration,
      priority: values.priority,
    });
  } catch (error) {
    if (isDuplicateKey(error)) return duplicateName();

    const details = validationDetails(error);
    if (details) {
      return fail(400, "Please fix the highlighted fields.", details);
    }
    throw error;
  }

  const status = values.isOpen === false ? "closed" : "open";
  try {
    await Queue.create({ serviceId: service._id, status });
  } catch (error) {
    await Service.deleteOne({ _id: service._id });
    throw error;
  }

  return { success: true, status: 201, service: toApiService(service, status) };
}

export async function updateService(adminEmail, id, body) {
  if (!isValidId(id)) {
    return fail(400, BAD_ID);
  }

  const denied = await checkAdministrator(adminEmail);
  if (denied) return denied;

  const service = await Service.findById(id);
  if (!service) {
    return fail(404, "Service not found.");
  }

  const { errors, values } = validateServiceInput(body);
  if (errors) {
    return fail(400, "Please fix the highlighted fields.", errors);
  }

  service.name = values.name;
  service.description = values.description;
  service.expectedDuration = values.expectedDuration;
  service.priority = values.priority;

  try {
    await service.save();
  } catch (error) {
    if (isDuplicateKey(error)) return duplicateName();

    const details = validationDetails(error);
    if (details) {
      return fail(400, "Please fix the highlighted fields.", details);
    }
    throw error;
  }

  const Queue = requireModel("Queue");
  let queue;
  if (values.isOpen === undefined) {
    queue = await Queue.findOne({ serviceId: service._id }).lean();
  } else {
    queue = await Queue.findOneAndUpdate(
      { serviceId: service._id },
      { status: values.isOpen ? "open" : "closed" },
      { returnDocument: "after" },
    ).lean();
  }

  return {
    success: true,
    status: 200,
    service: toApiService(service, queue?.status),
  };
}

export async function deleteService(adminEmail, id) {
  if (!isValidId(id)) {
    return fail(400, BAD_ID);
  }

  const denied = await checkAdministrator(adminEmail);
  if (denied) return denied;

  const service = await Service.findById(id);
  if (!service) {
    return fail(404, "Service not found.");
  }

  const Queue = requireModel("Queue");
  const queue = await Queue.findOne({ serviceId: service._id }).lean();

  const QueueEntry = mongoose.models.QueueEntry;
  if (queue && QueueEntry) {
    const waiting = await QueueEntry.exists({
      queueId: queue._id,
      status: "waiting",
    });
    if (waiting) {
      return fail(
        409,
        "People are still waiting in this queue. Serve or remove them before deleting the service.",
      );
    }
  }

  await Queue.deleteMany({ serviceId: service._id });
  await Service.deleteOne({ _id: service._id });

  return {
    success: true,
    status: 200,
    service: toApiService(service, queue?.status),
  };
}
