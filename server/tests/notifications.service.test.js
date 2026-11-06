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

import Notification from "../src/models/Notification.js";
import {
  ALMOST_READY_POSITION,
  createNotification,
  listNotifications,
  markNotificationRead,
  notifyAlmostReady,
  notifyJoinedQueue,
} from "../src/modules/notifications/notifications.service.js";

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
    [Notification, ...Object.values(models)].map((m) => m.init()),
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

const newId = () => new mongoose.Types.ObjectId();
let users;
let studentId;

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

beforeEach(async () => {
  await clearTestDb();
  users = await createTestUsers();
  studentId = String(users.student._id);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNotification", () => {
  test("stores a notification as 'sent' under the user's id and returns the API shape", async () => {
    const entryId = String(newId());
    const result = await createNotification({
      userId: studentId,
      entryId,
      type: "queue",
      message: "  Test notification ",
    });

    expect(result.status).toBe(201);
    expect(result.notification).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      entryId,
      type: "queue",
      message: "Test notification",
      read: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    });

    const stored = await Notification.findById(result.notification.id).lean();
    expect(stored.userId.equals(users.student._id)).toBe(true);
    expect(stored.status).toBe("sent");
    expect(stored.read).toBeUndefined();
  });

  test("accepts an ObjectId as well as a string, and no entry", async () => {
    const result = await createNotification({
      userId: users.student._id,
      message: "hi",
    });
    expect(result.status).toBe(201);
    expect(result.notification.entryId).toBeNull();
    expect(result.notification.read).toBe(false);
  });

  test("rejects invalid input", async () => {
    const userId = studentId;
    expect((await createNotification()).status).toBe(400);
    expect((await createNotification({ message: "hello" })).status).toBe(400);
    expect(
      (await createNotification({ userId: "not-an-id", message: "hello" }))
        .status,
    ).toBe(400);
    expect((await createNotification({ userId, message: "" })).status).toBe(
      400,
    );
    expect((await createNotification({ userId, message: 5 })).status).toBe(400);
    expect(
      (await createNotification({ userId, message: "m".repeat(501) })).status,
    ).toBe(400);
    expect(
      (await createNotification({ userId, message: "hi", type: "invalid" }))
        .status,
    ).toBe(400);
    expect(
      (await createNotification({ userId, message: "hi", entryId: "3" }))
        .status,
    ).toBe(400);
    expect(await Notification.countDocuments()).toBe(0);
  });

  test("never throws when the database fails (callers may not wait for it)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Notification, "create").mockRejectedValueOnce(
      new Error("connection lost"),
    );

    const result = await createNotification({
      userId: studentId,
      message: "hi",
    });
    expect(result).toMatchObject({ success: false, status: 500 });
  });
});

describe("listNotifications", () => {
  test("lists newest first with the right unreadCount, using read instead of status", async () => {
    const old = await Notification.create({
      userId: users.student._id,
      type: "queue",
      message: "oldest",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      status: "viewed",
    });
    await Notification.create({
      userId: users.student._id,
      type: "status",
      message: "middle",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });
    await Notification.create({
      userId: users.student._id,
      type: "status",
      message: "newest",
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });

    const listed = await listNotifications("  Student@UH.edu ");
    expect(listed.status).toBe(200);
    expect(listed.notifications.map((n) => n.message)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
    expect(listed.unreadCount).toBe(2);
    expect(listed.notifications.map((n) => n.read)).toEqual([
      false,
      false,
      true,
    ]);
    expect(listed.notifications[2].id).toBe(String(old._id));
    expect(listed.notifications[0]).not.toHaveProperty("status");
    expect(listed.notifications[0]).not.toHaveProperty("userId");
  });

  test("orders notifications made in the same moment by id, newest first", async () => {
    const when = new Date("2026-02-02T00:00:00Z");
    const a = await Notification.create({
      userId: users.student._id,
      type: "queue",
      message: "first",
      createdAt: when,
    });
    const b = await Notification.create({
      userId: users.student._id,
      type: "queue",
      message: "second",
      createdAt: when,
    });
    const listed = await listNotifications("student@uh.edu");
    expect(listed.notifications.map((n) => n.id)).toEqual([
      String(b._id),
      String(a._id),
    ]);
  });

  test("can list only unread notifications", async () => {
    await createNotification({ userId: studentId, message: "a" });
    const b = await createNotification({ userId: studentId, message: "b" });
    await markNotificationRead("student@uh.edu", b.notification.id);

    const unread = await listNotifications("student@uh.edu", {
      unreadOnly: true,
    });
    expect(unread.notifications.map((n) => n.message)).toEqual(["a"]);
    expect(unread.unreadCount).toBe(1);
  });

  test("users only see their own notifications", async () => {
    await createNotification({ userId: studentId, message: "mine" });
    await createNotification({ userId: users.other._id, message: "theirs" });
    const listed = await listNotifications("student@uh.edu");
    expect(listed.notifications.map((n) => n.message)).toEqual(["mine"]);
  });

  test("checks the email and returns an empty list for an unknown user", async () => {
    expect((await listNotifications("")).status).toBe(400);
    expect((await listNotifications(undefined)).status).toBe(400);
    expect((await listNotifications(`${"e".repeat(250)}@uh.edu`)).status).toBe(
      400,
    );
    expect(await listNotifications("nobody@uh.edu")).toMatchObject({
      success: true,
      notifications: [],
      unreadCount: 0,
    });
  });
});

describe("markNotificationRead", () => {
  test("marks a notification as viewed and the change is saved", async () => {
    const created = await createNotification({
      userId: studentId,
      message: "hi",
    });

    const marked = await markNotificationRead(
      "student@uh.edu",
      created.notification.id,
    );
    expect(marked.status).toBe(200);
    expect(marked.notification).toMatchObject({
      id: created.notification.id,
      read: true,
    });

    expect((await Notification.findById(created.notification.id)).status).toBe(
      "viewed",
    );
    expect((await listNotifications("student@uh.edu")).unreadCount).toBe(0);
  });

  test("marking another user's notification returns 404 and changes nothing", async () => {
    const mine = await createNotification({
      userId: studentId,
      message: "mine",
    });
    const result = await markNotificationRead(
      "other@uh.edu",
      mine.notification.id,
    );
    expect(result.status).toBe(404);
    expect((await Notification.findById(mine.notification.id)).status).toBe(
      "sent",
    );
  });

  test("an invalid id returns 400, a missing one 404", async () => {
    expect((await markNotificationRead("student@uh.edu", "abc")).status).toBe(
      400,
    );
    expect(
      (await markNotificationRead("student@uh.edu", undefined)).status,
    ).toBe(400);
    expect((await markNotificationRead("student@uh.edu", "42")).status).toBe(
      400,
    );
    expect(
      (await markNotificationRead("student@uh.edu", String(newId()))).status,
    ).toBe(404);
    expect(
      (await markNotificationRead("nobody@uh.edu", String(newId()))).status,
    ).toBe(404);
  });

  test("needs an email", async () => {
    expect((await markNotificationRead("", String(newId()))).status).toBe(400);
  });
});

describe("queue notifications", () => {
  test("notifies a user who joined a queue", async () => {
    const entryId = String(newId());
    const result = await notifyJoinedQueue({
      userId: studentId,
      entryId,
      serviceName: "Password Reset",
    });
    expect(result.notification).toMatchObject({
      type: "queue",
      entryId,
      message: "You joined the Password Reset queue.",
    });
  });

  test("the 'almost up' notification is not sent twice", async () => {
    const args = {
      userId: studentId,
      entryId: String(newId()),
      serviceName: "Password Reset",
    };
    const first = await notifyAlmostReady(args);
    const second = await notifyAlmostReady(args);

    expect(first.success).toBe(true);
    expect(first.notification.message).toBe(
      "You are almost up for Password Reset.",
    );
    expect(second.duplicate).toBe(true);
    expect(await Notification.countDocuments()).toBe(1);

    // A different ticket, or a different user, still gets their own.
    expect(
      (await notifyAlmostReady({ ...args, entryId: String(newId()) }))
        .duplicate,
    ).toBeUndefined();
    expect(
      (await notifyAlmostReady({ ...args, userId: String(users.other._id) }))
        .duplicate,
    ).toBeUndefined();
    expect(await Notification.countDocuments()).toBe(3);
  });

  test("a notice without an entry id is not de-duplicated", async () => {
    const args = { userId: studentId, serviceName: "Password Reset" };
    await notifyAlmostReady(args);
    expect((await notifyAlmostReady(args)).duplicate).toBeUndefined();
    expect(await Notification.countDocuments()).toBe(2);
  });

  test("old-style calls with an email instead of a user id are rejected without touching the database", async () => {
    const result = await notifyAlmostReady({
      userEmail: "student@uh.edu",
      entryId: 5,
      serviceName: "X",
    });
    expect(result.status).toBe(400);
    expect(
      (
        await notifyJoinedQueue({
          userEmail: "student@uh.edu",
          serviceName: "X",
        })
      ).status,
    ).toBe(400);
    expect(await Notification.countDocuments()).toBe(0);
  });

  test("almost-up does not throw when the duplicate check fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Notification, "exists").mockRejectedValueOnce(
      new Error("connection lost"),
    );
    const result = await notifyAlmostReady({
      userId: studentId,
      entryId: String(newId()),
      serviceName: "X",
    });
    expect(result).toMatchObject({ success: false, status: 500 });
  });

  test("exposes the almost-ready position", () => {
    expect(ALMOST_READY_POSITION).toBe(2);
  });
});

describe("Notification model (database-level validation)", () => {
  const base = () => ({
    userId: users.student._id,
    type: "queue",
    message: "hello",
  });

  test("rejects bad data even when the service layer is skipped", async () => {
    const bad = [
      { ...base(), userId: undefined },
      { ...base(), type: "email" },
      { ...base(), type: undefined },
      { ...base(), message: undefined },
      { ...base(), message: "m".repeat(501) },
      { ...base(), status: "read" },
    ];
    for (const doc of bad) {
      await expect(Notification.create(doc)).rejects.toThrow(
        /validation failed/i,
      );
    }
  });

  test("defaults to 'sent', no entry and a timestamp", async () => {
    const doc = await Notification.create(base());
    expect(doc.status).toBe("sent");
    expect(doc.entryId).toBeNull();
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  test("'viewed' is a valid status and toJSON gives a string id", async () => {
    const doc = await Notification.create({ ...base(), status: "viewed" });
    const json = doc.toJSON();
    expect(doc.status).toBe("viewed");
    expect(json.id).toBe(String(doc._id));
    expect(json).not.toHaveProperty("_id");
    expect(json).not.toHaveProperty("__v");
  });
});

describe("when other modules' models are missing", () => {
  test("listing explains that UserCredentials isn't loaded", async () => {
    const saved = mongoose.models.UserCredentials;
    delete mongoose.models.UserCredentials;
    try {
      await expect(listNotifications("student@uh.edu")).rejects.toThrow(
        /UserCredentials model is not registered/,
      );
    } finally {
      mongoose.models.UserCredentials = saved;
    }
  });

  test("blank emails never reach the user lookup", async () => {
    expect((await listNotifications("   ")).status).toBe(400);
    expect((await markNotificationRead("   ", String(newId()))).status).toBe(
      400,
    );
  });
});
