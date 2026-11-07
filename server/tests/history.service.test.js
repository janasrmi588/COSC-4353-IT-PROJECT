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
} from "vitest";

import QueueEntry from "../src/models/QueueEntry.js";
import UserCredentials from "../src/models/UserCredentials.js";
import {
  FINISHED_STATUSES,
  listHistory,
} from "../src/modules/history/history.service.js";

// ---------- in-memory database ----------

let memoryServer = null;

beforeAll(async () => {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }

  await mongoose.connect(uri, {
    dbName: `queuesmart_test_${randomUUID().slice(0, 8)}`,
  });

  await Promise.all([QueueEntry, UserCredentials].map((m) => m.init()));
}, 60_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

afterEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

// ---------- fixtures and helpers ----------

let alice;
let bob;

beforeEach(async () => {
  alice = await UserCredentials.create({
    email: "alice@uh.edu",
    passwordHash: "test-hash",
  });
  bob = await UserCredentials.create({
    email: "bob@uh.edu",
    passwordHash: "test-hash",
  });
});

let ticketCount = 0;

// A QueueEntry written straight to the database. History only reads entries,
// so the queue and service ids do not need real documents behind them.
function makeEntry(user, overrides = {}) {
  ticketCount += 1;
  return QueueEntry.create({
    queueId: new mongoose.Types.ObjectId(),
    serviceId: new mongoose.Types.ObjectId(),
    serviceName: "Password Reset",
    userId: user._id,
    userEmail: user.email,
    ticketNumber: `Q-${ticketCount}`,
    title: "Cannot log in",
    description: "My password stopped working.",
    priority: "high",
    status: "served",
    joinedAt: new Date("2026-10-01T09:00:00Z"),
    finishedAt: new Date("2026-10-01T09:20:00Z"),
    ...overrides,
  });
}

// ---------- tests ----------

describe("History", () => {
  test("only lists the user's finished entries", async () => {
    await makeEntry(alice, { status: "served" });
    await makeEntry(alice, { status: "canceled" });
    await makeEntry(alice, { status: "waiting", finishedAt: null });
    await makeEntry(bob, { status: "served" });

    const result = await listHistory("alice@uh.edu");

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.history).toHaveLength(2);
    expect(
      result.history.every((entry) => FINISHED_STATUSES.includes(entry.status)),
    ).toBe(true);
  });

  test("returns the fields the history page reads", async () => {
    const saved = await makeEntry(alice);

    const [entry] = (await listHistory("alice@uh.edu")).history;

    expect(entry).toEqual({
      id: String(saved._id),
      ticketNumber: saved.ticketNumber,
      serviceId: String(saved.serviceId),
      serviceName: "Password Reset",
      title: "Cannot log in",
      description: "My password stopped working.",
      status: "served",
      outcome: "Served",
      joinedAt: "2026-10-01T09:00:00.000Z",
      finishedAt: "2026-10-01T09:20:00.000Z",
      date: "2026-10-01",
    });
    expect(entry.userId).toBeUndefined();
  });

  test("labels a canceled entry and dates it by when it was joined", async () => {
    await makeEntry(alice, { status: "canceled", finishedAt: null });

    const [entry] = (await listHistory("alice@uh.edu")).history;

    expect(entry.outcome).toBe("Canceled");
    expect(entry.finishedAt).toBeNull();
    expect(entry.date).toBe("2026-10-01");
  });

  test("lists the most recently finished entry first", async () => {
    await makeEntry(alice, { finishedAt: new Date("2026-10-01T09:20:00Z") });
    await makeEntry(alice, { finishedAt: new Date("2026-10-03T09:20:00Z") });
    await makeEntry(alice, { finishedAt: new Date("2026-10-02T09:20:00Z") });

    const result = await listHistory("alice@uh.edu");

    expect(result.history.map((entry) => entry.date)).toEqual([
      "2026-10-03",
      "2026-10-02",
      "2026-10-01",
    ]);
  });

  test("keeps the service name after the service is gone", async () => {
    // The entry stores its own copy of the name, and no Service document exists.
    await makeEntry(alice, { serviceName: "Retired Service" });

    const [entry] = (await listHistory("alice@uh.edu")).history;

    expect(entry.serviceName).toBe("Retired Service");
  });

  test("a user with no finished entries gets an empty list", async () => {
    await makeEntry(alice, { status: "waiting", finishedAt: null });

    const result = await listHistory("alice@uh.edu");

    expect(result.success).toBe(true);
    expect(result.history).toEqual([]);
  });

  test("the email is matched without caring about case or spaces", async () => {
    await makeEntry(alice);

    const result = await listHistory("  Alice@UH.edu ");

    expect(result.success).toBe(true);
    expect(result.history).toHaveLength(1);
  });

  test("a missing, invalid or unknown email returns 401", async () => {
    await makeEntry(alice);

    for (const email of [undefined, null, 42, "", "   ", "nobody@uh.edu"]) {
      const result = await listHistory(email);

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
    }
  });
});
