import { services, users } from "../../data/store.js";

export const PRIORITY_LEVELS = ["low", "medium", "high"];

export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;
export const DURATION_MIN = 1;
export const DURATION_MAX = 480; // minutes

function fail(status, message, details) {
  const result = { success: false, status, message };
  if (details) result.details = details;
  return result;
}

let highestIdIssued = Math.max(0, ...services.map((s) => s.id));

function nextServiceId() {
  highestIdIssued = Math.max(highestIdIssued, ...services.map((s) => s.id)) + 1;
  return highestIdIssued;
}

function checkAdministrator(email) {
  if (typeof email !== "string" || !email.trim()) {
    return fail(401, "Please log in as an administrator.");
  }

  const wanted = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === wanted);

  if (!user || user.role !== "administrator") {
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

function findDuplicateName(name, ignoreId = null) {
  const wanted = name.toLowerCase();
  return services.find(
    (s) => s.id !== ignoreId && s.name.toLowerCase() === wanted,
  );
}

export function listServices() {
  return {
    success: true,
    status: 200,
    services: [...services].sort((a, b) => a.id - b.id).map((s) => ({ ...s })),
  };
}

export function getServiceById(id) {
  const service = services.find((s) => s.id === id);
  if (!service) {
    return fail(404, "Service not found.");
  }
  return { success: true, status: 200, service: { ...service } };
}

export function createService(adminEmail, body) {
  const denied = checkAdministrator(adminEmail);
  if (denied) return denied;

  const { errors, values } = validateServiceInput(body);
  if (errors) {
    return fail(400, "Please fix the highlighted fields.", errors);
  }

  if (findDuplicateName(values.name)) {
    return fail(409, "A service with this name already exists.", {
      name: "A service with this name already exists.",
    });
  }

  const service = {
    id: nextServiceId(),
    name: values.name,
    description: values.description,
    expectedDuration: values.expectedDuration,
    priority: values.priority,
    isOpen: values.isOpen ?? true,
  };

  services.push(service);

  return { success: true, status: 201, service: { ...service } };
}

export function updateService(adminEmail, id, body) {
  if (!Number.isInteger(id) || id < 1) {
    return fail(400, "Service id must be a positive whole number.");
  }

  const denied = checkAdministrator(adminEmail);
  if (denied) return denied;

  const service = services.find((s) => s.id === id);
  if (!service) {
    return fail(404, "Service not found.");
  }

  const { errors, values } = validateServiceInput(body);
  if (errors) {
    return fail(400, "Please fix the highlighted fields.", errors);
  }

  if (findDuplicateName(values.name, id)) {
    return fail(409, "A service with this name already exists.", {
      name: "A service with this name already exists.",
    });
  }

  service.name = values.name;
  service.description = values.description;
  service.expectedDuration = values.expectedDuration;
  service.priority = values.priority;
  if (values.isOpen !== undefined) {
    service.isOpen = values.isOpen;
  }

  return { success: true, status: 200, service: { ...service } };
}

export function deleteService(adminEmail, id) {
  if (!Number.isInteger(id) || id < 1) {
    return fail(400, "Service id must be a positive whole number.");
  }

  const denied = checkAdministrator(adminEmail);
  if (denied) return denied;

  const index = services.findIndex((s) => s.id === id);
  if (index === -1) {
    return fail(404, "Service not found.");
  }
  const [removed] = services.splice(index, 1);

  return { success: true, status: 200, service: { ...removed } };
}
