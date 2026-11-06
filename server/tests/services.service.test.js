import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import Service from "../src/models/Service.js";
import {
  createService,
  deleteService,
  getServiceById,
  listServices,
  updateService,
  validateServiceInput,
} from "../src/modules/services/services.service.js";

import Notification from "../src/models/Notification.js";

const { Schema } = mongoose;
let memoryServer = null;

function standIn(name, definition) {
  return mongoose.models[name] || mongoose.model(name, new Schema(definition));
}

function registerStandIns() {
  return {
    UserCredentials: standIn("UserCredentials", {
      email: { type: String, required: true, unique: true, lowercase: true },
      role: { type: String, required: true },
    }),
    Queue: standIn("Queue", {
      serviceId: {
        type: Schema.Types.ObjectId,
        ref: "Service",
        required: true,
        unique: true,
      },
      status: { type: String, enum: ["open", "closed"], default: "open" },
    }),
    QueueEntry: standIn("QueueEntry", {
      queueId: { type: Schema.Types.ObjectId, ref: "Queue", required: true },
      userId: { type: Schema.Types.ObjectId, ref: "UserCredentials" },
      status: {
        type: String,
        enum: ["waiting", "served", "canceled"],
        default: "waiting",
      },
    }),
  };
}

async function connectTestDb() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }

  await mongoose.connect(uri, {
    dbName: `queuesmart_test_${randomUUID().slice(0, 8)}`,
  });

  const models = registerStandIns();
  await Promise.all(
    [Service, Notification, ...Object.values(models)].map((m) => m.init()),
  );
}

async function clearTestDb() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function disconnectTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

async function createTestUsers() {
  const { UserCredentials } = registerStandIns();
  const student = await UserCredentials.create({
    email: "student@uh.edu",
    role: "user",
  });
  const other = await UserCredentials.create({
    email: "other@uh.edu",
    role: "user",
  });
  const admin = await UserCredentials.create({
    email: "admin@uh.edu",
    role: "administrator",
  });
  return { student, other, admin };
}

async function createTestServices() {
  const { Queue } = registerStandIns();
  const starters = [
    ["Password Reset", "Reset or unlock your university account.", true],
    [
      "Wi-Fi / Network Help",
      "Trouble connecting to campus Wi-Fi or the VPN.",
      true,
    ],
    [
      "Software Install Request",
      "Request or troubleshoot licensed software.",
      true,
    ],
    ["Hardware Repair", "Laptop, printer, and lab computer issues.", false],
  ];

  const created = [];
  for (const [name, description, open] of starters) {
    const service = await Service.create({
      name,
      description,
      expectedDuration: 10,
      priority: "high",
    });
    await Queue.create({
      serviceId: service._id,
      status: open ? "open" : "closed",
    });
    created.push(service);
  }
  return created;
}

const ADMIN = "admin@uh.edu";
const STUDENT = "student@uh.edu";
const MISSING_ID = String(new mongoose.Types.ObjectId());

const validService = {
  name: "Device Setup",
  description: "Help configure a device.",
  expectedDuration: 20,
  priority: "medium",
};

let seeded;
let Queue;
let QueueEntry;

beforeAll(async () => {
  await connectTestDb();
  ({ Queue, QueueEntry } = registerStandIns());
});
afterAll(disconnectTestDb);

beforeEach(async () => {
  await clearTestDb();
  await createTestUsers();
  seeded = await createTestServices();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateServiceInput", () => {
  test("requires every field", () => {
    const { errors } = validateServiceInput({});
    expect(errors.name).toBe("Service name is required.");
    expect(errors.description).toBe("Description is required.");
    expect(errors.expectedDuration).toBe("Expected duration is required.");
    expect(errors.priority).toBe("Priority level is required.");
  });

  test("treats a missing or non-object body like an empty one", () => {
    expect(validateServiceInput(undefined).errors.name).toBeDefined();
    expect(validateServiceInput([]).errors.name).toBeDefined();
  });

  test("enforces types and length limits with the current messages", () => {
    const { errors } = validateServiceInput({
      name: 42,
      description: "x".repeat(501),
      expectedDuration: 1.5,
      priority: "urgent",
      isOpen: "yes",
    });
    expect(errors.name).toBe("Service name must be text.");
    expect(errors.description).toBe(
      "Description must be 500 characters or fewer.",
    );
    expect(errors.expectedDuration).toBe(
      "Expected duration must be a whole number of minutes.",
    );
    expect(errors.priority).toBe(
      "Priority level must be one of: low, medium, high.",
    );
    expect(errors.isOpen).toBe("Open status must be true or false.");

    expect(
      validateServiceInput({ ...validService, name: "n".repeat(101) }).errors
        .name,
    ).toBe("Service name must be 100 characters or fewer.");
    expect(
      validateServiceInput({ ...validService, description: 7 }).errors
        .description,
    ).toBe("Description must be text.");
    expect(
      validateServiceInput({ ...validService, expectedDuration: 481 }).errors
        .expectedDuration,
    ).toBe("Expected duration must be between 1 and 480 minutes.");
    expect(
      validateServiceInput({ ...validService, expectedDuration: 0 }).errors
        .expectedDuration,
    ).toBe("Expected duration must be between 1 and 480 minutes.");
  });

  test("returns trimmed values when the input is valid", () => {
    const { values } = validateServiceInput({
      ...validService,
      name: "  Device Setup  ",
    });
    expect(values.name).toBe("Device Setup");
    expect(values.isOpen).toBeUndefined();
  });
});

describe("listServices / getServiceById", () => {
  test("lists services in creation order with isOpen taken from the Queue", async () => {
    const result = await listServices();
    expect(result.status).toBe(200);
    expect(result.services.map((s) => s.name)).toEqual(
      seeded.map((s) => s.name),
    );
    expect(result.services.map((s) => s.isOpen)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  test("returns id as a string and hides _id, __v and internals", async () => {
    const [first] = (await listServices()).services;
    expect(first).toEqual({
      id: String(seeded[0]._id),
      name: "Password Reset",
      description: "Reset or unlock your university account.",
      expectedDuration: 10,
      priority: "high",
      isOpen: true,
    });
  });

  test("a service with no queue counts as closed", async () => {
    await Queue.deleteOne({ serviceId: seeded[0]._id });
    expect((await listServices()).services[0].isOpen).toBe(false);
  });

  test("finds one service, or reports 400 / 404", async () => {
    const found = await getServiceById(String(seeded[1]._id));
    expect(found.service.name).toBe("Wi-Fi / Network Help");
    expect(found.service.isOpen).toBe(true);
    expect((await getServiceById(String(seeded[3]._id))).service.isOpen).toBe(
      false,
    );
    expect((await getServiceById("abc")).status).toBe(400);
    expect((await getServiceById(MISSING_ID)).status).toBe(404);
  });
});

describe("createService", () => {
  test("creates a Service and its Queue (open by default)", async () => {
    const result = await createService(ADMIN, validService);
    expect(result.status).toBe(201);
    expect(result.service).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      ...validService,
      isOpen: true,
    });

    const stored = await Service.findById(result.service.id);
    expect(stored.name).toBe("Device Setup");
    const queue = await Queue.findOne({ serviceId: stored._id });
    expect(queue.status).toBe("open");
    expect(await Queue.countDocuments({ serviceId: stored._id })).toBe(1);
  });

  test("creates the queue closed when isOpen is false", async () => {
    const result = await createService(ADMIN, {
      ...validService,
      isOpen: false,
    });
    expect(result.service.isOpen).toBe(false);
    expect((await Queue.findOne({ serviceId: result.service.id })).status).toBe(
      "closed",
    );
  });

  test("trims text", async () => {
    const result = await createService(ADMIN, {
      ...validService,
      name: "  Spaces  ",
    });
    expect(result.service.name).toBe("Spaces");
  });

  test("a non-admin or logged-out caller is refused and nothing is created", async () => {
    expect((await createService(undefined, validService)).status).toBe(401);
    expect((await createService("   ", validService)).status).toBe(401);
    expect((await createService(STUDENT, validService)).status).toBe(403);
    expect((await createService("nobody@uh.edu", validService)).status).toBe(
      403,
    );
    expect(await Service.countDocuments()).toBe(4);
    expect(await Queue.countDocuments()).toBe(4);
  });

  test("returns field errors for invalid input", async () => {
    const result = await createService(ADMIN, {
      ...validService,
      priority: "x",
    });
    expect(result.status).toBe(400);
    expect(result.message).toBe("Please fix the highlighted fields.");
    expect(result.details.priority).toBeDefined();
  });

  test("a duplicate name (in any letter case) returns 409 and creates no queue", async () => {
    for (const name of [
      "Password Reset",
      "password reset",
      "PASSWORD RESET",
      "  Password Reset ",
    ]) {
      const result = await createService(ADMIN, { ...validService, name });
      expect(result.status).toBe(409);
      expect(result.message).toBe("A service with this name already exists.");
      expect(result.details.name).toBe(
        "A service with this name already exists.",
      );
    }
    expect(await Service.countDocuments()).toBe(4);
    expect(await Queue.countDocuments()).toBe(4);
  });

  test("removes the Service again if its Queue cannot be created", async () => {
    vi.spyOn(Queue, "create").mockRejectedValueOnce(new Error("queue failed"));
    await expect(createService(ADMIN, validService)).rejects.toThrow(
      "queue failed",
    );
    expect(await Service.countDocuments({ name: validService.name })).toBe(0);
  });

  test("turns a database validation error into a 400", async () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      "priority",
      new mongoose.Error.ValidatorError({
        message: "Priority level is required.",
        path: "priority",
      }),
    );
    vi.spyOn(Service, "create").mockRejectedValueOnce(error);

    const result = await createService(ADMIN, validService);
    expect(result.status).toBe(400);
    expect(result.details.priority).toBe("Priority level is required.");
  });

  test("passes unexpected database errors up to the caller", async () => {
    vi.spyOn(Service, "create").mockRejectedValueOnce(
      new Error("connection lost"),
    );
    await expect(createService(ADMIN, validService)).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("updateService", () => {
  const idOf = (i) => String(seeded[i]._id);

  test("changes the service fields", async () => {
    const result = await updateService(ADMIN, idOf(0), {
      ...validService,
      name: "Account Unlock",
      priority: "low",
    });
    expect(result.status).toBe(200);
    expect(result.service).toMatchObject({
      id: idOf(0),
      name: "Account Unlock",
      priority: "low",
      isOpen: true,
    });
    expect((await Service.findById(idOf(0))).name).toBe("Account Unlock");
  });

  test("toggles the Queue status when isOpen is sent (the Close queue / Open queue button)", async () => {
    const closed = await updateService(ADMIN, idOf(0), {
      ...validService,
      name: "Password Reset",
      isOpen: false,
    });
    expect(closed.service.isOpen).toBe(false);
    expect((await Queue.findOne({ serviceId: idOf(0) })).status).toBe("closed");
    expect((await listServices()).services[0].isOpen).toBe(false);

    const reopened = await updateService(ADMIN, idOf(0), {
      ...validService,
      name: "Password Reset",
      isOpen: true,
    });
    expect(reopened.service.isOpen).toBe(true);
    expect((await Queue.findOne({ serviceId: idOf(0) })).status).toBe("open");
  });

  test("leaves the Queue alone when isOpen is not sent, and still reports it", async () => {
    const result = await updateService(ADMIN, idOf(3), {
      ...validService,
      name: "Hardware Fixes",
    });
    expect(result.service.isOpen).toBe(false);
    expect((await Queue.findOne({ serviceId: idOf(3) })).status).toBe("closed");
  });

  test("a service can keep its own name, even with different letter case", async () => {
    const result = await updateService(ADMIN, idOf(0), {
      ...validService,
      name: "PASSWORD RESET",
    });
    expect(result.status).toBe(200);
    expect(result.service.name).toBe("PASSWORD RESET");
  });

  test("checks the id, the login, existence, the input and duplicate names", async () => {
    expect((await updateService(ADMIN, "abc", validService)).status).toBe(400);
    expect((await updateService(undefined, idOf(0), validService)).status).toBe(
      401,
    );
    expect((await updateService(STUDENT, idOf(0), validService)).status).toBe(
      403,
    );
    expect((await updateService(ADMIN, MISSING_ID, validService)).status).toBe(
      404,
    );
    expect((await updateService(ADMIN, idOf(0), {})).status).toBe(400);
  });

  test("renaming to a name another service uses returns 409 (duplicate-key error mapped)", async () => {
    vi.spyOn(Service.prototype, "save").mockRejectedValueOnce(
      Object.assign(new Error("E11000 duplicate key"), { code: 11000 }),
    );
    const duplicate = await updateService(ADMIN, idOf(0), {
      ...validService,
      name: "hardware repair",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.message).toBe("A service with this name already exists.");
    expect(duplicate.details.name).toMatch(/already exists/);
  });

  test.skipIf(process.env.FERRETDB)(
    "renaming to a name another service uses is refused by the real unique index",
    async () => {
      const duplicate = await updateService(ADMIN, idOf(0), {
        ...validService,
        name: "hardware repair",
      });
      expect(duplicate.status).toBe(409);
      expect((await Service.findById(idOf(0))).name).toBe("Password Reset");
    },
  );

  test("turns a database validation error into a 400 and passes other errors up", async () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      "name",
      new mongoose.Error.ValidatorError({
        message: "Service name is required.",
        path: "name",
      }),
    );
    vi.spyOn(Service.prototype, "save").mockRejectedValueOnce(error);
    const result = await updateService(ADMIN, idOf(0), validService);
    expect(result.status).toBe(400);
    expect(result.details.name).toBe("Service name is required.");

    vi.spyOn(Service.prototype, "save").mockRejectedValueOnce(
      new Error("connection lost"),
    );
    await expect(updateService(ADMIN, idOf(0), validService)).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("deleteService", () => {
  test("deletes both the Service and its Queue", async () => {
    const id = String(seeded[1]._id);
    const result = await deleteService(ADMIN, id);
    expect(result.status).toBe(200);
    expect(result.service).toMatchObject({ id, name: "Wi-Fi / Network Help" });

    expect(await Service.findById(id)).toBeNull();
    expect(await Queue.countDocuments({ serviceId: id })).toBe(0);
    expect((await getServiceById(id)).status).toBe(404);
  });

  test("refuses with 409 while people are waiting, and deletes nothing", async () => {
    const queue = await Queue.findOne({ serviceId: seeded[0]._id });
    await QueueEntry.create({ queueId: queue._id, status: "waiting" });

    const result = await deleteService(ADMIN, String(seeded[0]._id));
    expect(result.status).toBe(409);
    expect(result.message).toMatch(/still waiting/);
    expect(await Service.countDocuments()).toBe(4);
    expect(await Queue.countDocuments()).toBe(4);
  });

  test("finished entries do not block a delete", async () => {
    const queue = await Queue.findOne({ serviceId: seeded[0]._id });
    await QueueEntry.create({ queueId: queue._id, status: "served" });
    await QueueEntry.create({ queueId: queue._id, status: "canceled" });

    expect((await deleteService(ADMIN, String(seeded[0]._id))).status).toBe(
      200,
    );
  });

  test("checks the id, the login and existence", async () => {
    const id = String(seeded[0]._id);
    expect((await deleteService(ADMIN, "abc")).status).toBe(400);
    expect((await deleteService(undefined, id)).status).toBe(401);
    expect((await deleteService(STUDENT, id)).status).toBe(403);
    expect((await deleteService(ADMIN, MISSING_ID)).status).toBe(404);
    expect(await Service.countDocuments()).toBe(4);
  });
});

describe("Service model (database-level validation)", () => {
  const base = { ...validService };

  test("rejects bad data even when the service layer is skipped", async () => {
    const bad = [
      { ...base, name: undefined },
      { ...base, name: "n".repeat(101) },
      { ...base, description: undefined },
      { ...base, description: "d".repeat(501) },
      { ...base, expectedDuration: undefined },
      { ...base, expectedDuration: 0 },
      { ...base, expectedDuration: 481 },
      { ...base, expectedDuration: 2.5 },
      { ...base, priority: "urgent" },
      { ...base, priority: undefined },
    ];
    for (const doc of bad) {
      await expect(Service.create(doc)).rejects.toThrow(/validation failed/i);
    }
  });

  test("enforces unique names (any letter case) in the database", async () => {
    await expect(
      Service.create({ ...base, name: "password RESET" }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
