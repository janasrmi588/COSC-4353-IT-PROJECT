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
import Queue from "../src/models/Queue.js";
import QueueEntry from "../src/models/QueueEntry.js";
import Service from "../src/models/Service.js";
import UserCredentials from "../src/models/UserCredentials.js";
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  compareEntries,
  joinQueue,
  leaveQueue,
  listMyQueues,
  serveNext,
  viewQueue,
} from "../src/modules/queue/queue.service.js";

// ---------- in-memory database ----------

let memoryServer = null;

async function connectTestDb() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }

  await mongoose.connect(uri, {
    dbName: `queuesmart_test_${randomUUID().slice(0, 8)}`,
  });

  // init() waits for the indexes, so the unique-index tests are reliable.
  await Promise.all(
    [Service, Queue, QueueEntry, UserCredentials, Notification].map((m) =>
      m.init(),
    ),
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

// ---------- fixtures and helpers ----------

let admin;
let alice;
let bob;
let carol;
let reset; // low priority, 10 minutes
let hardware; // high priority, 30 minutes
let installs; // medium priority, closed

async function makeUser(email, role = "user") {
  return UserCredentials.create({ email, passwordHash: "test-hash", role });
}

async function makeService({
  name,
  priority = "medium",
  expectedDuration = 10,
  status = "open",
}) {
  const service = await Service.create({
    name,
    description: `${name} help`,
    expectedDuration,
    priority,
  });
  const queue = await Queue.create({ serviceId: service._id, status });
  return { service, queue, id: String(service._id) };
}

function ticket(target, overrides = {}) {
  return {
    serviceId: target.id,
    title: "Cannot connect to Wi-Fi",
    description: "The connection drops every few minutes.",
    ...overrides,
  };
}

// Joins and returns the entry, failing the test if the join did not work.
async function join(email, target, overrides) {
  const result = await joinQueue(email, ticket(target, overrides));
  expect(result.status).toBe(201);
  return result.entry;
}

// A QueueEntry written straight to the database, for the model rules.
function rawEntry(target, user, overrides = {}) {
  return {
    queueId: target.queue._id,
    serviceId: target.service._id,
    serviceName: target.service.name,
    userId: user._id,
    userEmail: user.email,
    ticketNumber: "Q-1",
    title: "Title",
    description: "Description",
    priority: target.service.priority,
    ...overrides,
  };
}

async function messagesFor(user) {
  const notes = await Notification.find({ userId: user._id })
    .sort({ _id: 1 })
    .lean();
  return notes.map((n) => n.message);
}

beforeAll(async () => {
  await connectTestDb();
}, 60_000);

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  admin = await makeUser("admin@uh.edu", "administrator");
  alice = await makeUser("alice@uh.edu");
  bob = await makeUser("bob@uh.edu");
  carol = await makeUser("carol@uh.edu");

  reset = await makeService({
    name: "Password Reset",
    priority: "low",
    expectedDuration: 10,
  });
  hardware = await makeService({
    name: "Hardware Repair",
    priority: "high",
    expectedDuration: 30,
  });
  installs = await makeService({
    name: "Software Install",
    priority: "medium",
    expectedDuration: 15,
    status: "closed",
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearTestDb();
});

// ---------- who is allowed to call what ----------

describe("Access control", () => {
  const calls = {
    join: (email) => joinQueue(email, ticket(reset)),
    leave: (email, entryId) => leaveQueue(email, entryId),
    "my queues": (email) => listMyQueues(email),
    "view queue": (email) => viewQueue(email, reset.id),
    "serve next": (email) => serveNext(email, { serviceId: reset.id }),
  };

  // Users only: join, leave, my queues. Administrators only: view, serve.
  test.each([
    ["join", "admin@uh.edu"],
    ["leave", "admin@uh.edu"],
    ["my queues", "admin@uh.edu"],
    ["view queue", "alice@uh.edu"],
    ["serve next", "alice@uh.edu"],
  ])("%s refuses %s with 403", async (name, email) => {
    const entry = await join("alice@uh.edu", reset);

    const result = await calls[name](email, entry.id);

    expect(result.status).toBe(403);
    // Nothing was changed by the refused call.
    const saved = await QueueEntry.findById(entry.id).lean();
    expect(saved.status).toBe("waiting");
  });

  test.each(Object.keys(calls))(
    "%s returns 401 for a missing or unknown email",
    async (name) => {
      const entry = await join("alice@uh.edu", reset);

      expect((await calls[name](undefined, entry.id)).status).toBe(401);
      expect((await calls[name]("nobody@uh.edu", entry.id)).status).toBe(401);
    },
  );
});

// ---------- join ----------

describe("Join", () => {
  test("a user can join an open queue", async () => {
    const result = await joinQueue("alice@uh.edu", ticket(reset));

    expect(result.success).toBe(true);
    expect(result.status).toBe(201);

    const { entry } = result;
    expect(typeof entry.id).toBe("string");
    expect(entry).toMatchObject({
      ticketNumber: "Q-1",
      serviceId: reset.id,
      serviceName: "Password Reset",
      userEmail: "alice@uh.edu",
      status: "waiting",
      priority: "low",
      title: "Cannot connect to Wi-Fi",
      description: "The connection drops every few minutes.",
      finishedAt: null,
      position: 1,
      peopleAhead: 0,
      estimatedWait: 0,
    });
    expect(entry.userId).toBeUndefined();

    const saved = await QueueEntry.findById(entry.id).lean();
    expect(String(saved.userId)).toBe(String(alice._id));
    expect(String(saved.queueId)).toBe(String(reset.queue._id));
  });

  test("a closed queue returns 409", async () => {
    const result = await joinQueue("alice@uh.edu", ticket(installs));

    expect(result.status).toBe(409);
    expect(result.message).toMatch(/closed/i);
    expect(await QueueEntry.countDocuments()).toBe(0);
  });

  test("joining the same queue twice returns 409", async () => {
    await join("alice@uh.edu", reset);

    const result = await joinQueue("alice@uh.edu", ticket(reset));

    expect(result.status).toBe(409);
    expect(result.message).toMatch(/already in/i);
    expect(await QueueEntry.countDocuments()).toBe(1);

    // The failed attempt must not use up a ticket number.
    const next = await join("bob@uh.edu", reset);
    expect(next.ticketNumber).toBe("Q-2");
  });

  test("an unknown service returns 404 and a bad service id 400", async () => {
    const unknown = await joinQueue("alice@uh.edu", {
      ...ticket(reset),
      serviceId: String(new mongoose.Types.ObjectId()),
    });
    expect(unknown.status).toBe(404);

    for (const serviceId of ["not-an-id", undefined]) {
      const bad = await joinQueue("alice@uh.edu", {
        ...ticket(reset),
        serviceId,
      });
      expect(bad.status).toBe(400);
      expect(bad.message).toBe("Please choose a service.");
      expect(bad.details.serviceId).toBeTruthy();
    }
  });

  test.each([
    ["title", "   "],
    ["title", "x".repeat(TITLE_MAX_LENGTH + 1)],
    ["description", "   "],
    ["description", "x".repeat(DESCRIPTION_MAX_LENGTH + 1)],
  ])("a blank or too long %s returns 400", async (field, value) => {
    const other = field === "title" ? "description" : "title";

    const result = await joinQueue(
      "alice@uh.edu",
      ticket(reset, { [field]: value }),
    );

    expect(result.status).toBe(400);
    expect(result.details[field]).toBeTruthy();
    expect(result.details[other]).toBeUndefined();
  });

  test("a missing body reports every problem and saves nothing", async () => {
    const result = await joinQueue("alice@uh.edu", undefined);

    expect(result.status).toBe(400);
    expect(Object.keys(result.details).sort()).toEqual([
      "description",
      "serviceId",
      "title",
    ]);
    expect(await QueueEntry.countDocuments()).toBe(0);
    const queue = await Queue.findById(reset.queue._id).lean();
    expect(queue.ticketCounter).toBe(0);
  });

  test("the same person joining twice at once is only let in once", async () => {
    const results = await Promise.all([
      joinQueue("alice@uh.edu", ticket(reset)),
      joinQueue("alice@uh.edu", ticket(reset)),
    ]);

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await QueueEntry.countDocuments({ userId: alice._id, status: "waiting" }),
    ).toBe(1);
  });

  test("people joining at the same moment get different ticket numbers", async () => {
    const results = await Promise.all([
      joinQueue("alice@uh.edu", ticket(reset)),
      joinQueue("bob@uh.edu", ticket(reset)),
      joinQueue("carol@uh.edu", ticket(reset)),
    ]);

    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(results.map((r) => r.entry.ticketNumber).sort()).toEqual([
      "Q-1",
      "Q-2",
      "Q-3",
    ]);
  });
});

// ---------- leave ----------

describe("Leave", () => {
  test("a user can leave a queue", async () => {
    const entry = await join("alice@uh.edu", reset);

    const result = await leaveQueue("alice@uh.edu", entry.id);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.entry.status).toBe("canceled");
    expect(result.entry.position).toBeNull();

    const saved = await QueueEntry.findById(entry.id).lean();
    expect(saved.status).toBe("canceled");
    expect(saved.finishedAt).toBeInstanceOf(Date);
  });

  test("someone else's entry returns 404 and is left alone", async () => {
    const entry = await join("alice@uh.edu", reset);

    const result = await leaveQueue("bob@uh.edu", entry.id);

    expect(result.status).toBe(404);
    const saved = await QueueEntry.findById(entry.id).lean();
    expect(saved.status).toBe("waiting");
  });

  test("leaving twice returns 409", async () => {
    const entry = await join("alice@uh.edu", reset);
    await leaveQueue("alice@uh.edu", entry.id);

    const again = await leaveQueue("alice@uh.edu", entry.id);

    expect(again.status).toBe(409);
    expect(again.message).toMatch(/no longer waiting/i);
  });

  test("an invalid entry id returns 400", async () => {
    expect((await leaveQueue("alice@uh.edu", "not-an-id")).status).toBe(400);
    expect((await leaveQueue("alice@uh.edu", undefined)).status).toBe(400);
  });

  test("people behind the one who left move up", async () => {
    const first = await join("alice@uh.edu", reset);
    await join("bob@uh.edu", reset);
    await join("carol@uh.edu", reset);

    const before = await listMyQueues("carol@uh.edu");
    expect(before.entries[0]).toMatchObject({
      position: 3,
      peopleAhead: 2,
      estimatedWait: 20,
    });

    await leaveQueue("alice@uh.edu", first.id);

    const after = await listMyQueues("carol@uh.edu");
    expect(after.entries[0]).toMatchObject({
      position: 2,
      peopleAhead: 1,
      estimatedWait: 10,
    });
  });
});

// ---------- ordering ----------

describe("Ordering", () => {
  const base = { priority: "medium", joinedAt: "2026-01-01T09:00:00Z" };

  test("priority comes first, ahead of sortOrder and arrival time", () => {
    const earlyLow = { ...base, id: "a", priority: "low", sortOrder: 1 };
    const medium = { ...base, id: "b", sortOrder: 500 };
    const lateHigh = {
      ...base,
      id: "c",
      priority: "high",
      sortOrder: 999,
      joinedAt: "2026-01-01T10:00:00Z",
    };

    const sorted = [earlyLow, medium, lateHigh].sort(compareEntries);

    expect(sorted.map((e) => e.priority)).toEqual(["high", "medium", "low"]);
  });

  test("inside a priority group, lower sortOrder first, then earlier arrival", () => {
    const early = { ...base, id: "a", sortOrder: 5000 };
    const movedUp = {
      ...base,
      id: "b",
      sortOrder: 1000,
      joinedAt: "2026-01-01T10:00:00Z",
    };
    const sameEarly = { ...base, id: "c", sortOrder: 2000 };
    const sameLate = {
      ...base,
      id: "d",
      sortOrder: 2000,
      joinedAt: "2026-01-01T10:00:00Z",
    };

    expect(compareEntries(movedUp, early)).toBeLessThan(0);
    expect(compareEntries(sameEarly, sameLate)).toBeLessThan(0);
  });

  test("an entry with a lower sortOrder is seen and served first", async () => {
    const first = await join("alice@uh.edu", reset);
    const second = await join("bob@uh.edu", reset);
    await QueueEntry.updateOne(
      { _id: second.id },
      { sortOrder: first.sortOrder - 1000 },
    );

    const result = await viewQueue("admin@uh.edu", reset.id);
    expect(result.queue.map((e) => e.userEmail)).toEqual([
      "bob@uh.edu",
      "alice@uh.edu",
    ]);

    const served = await serveNext("admin@uh.edu", { serviceId: reset.id });
    expect(served.entry.userEmail).toBe("bob@uh.edu");
  });

  test("the combined line puts higher priority first", async () => {
    await join("alice@uh.edu", reset); // low, joined first
    await join("bob@uh.edu", hardware); // high, joined later

    const result = await viewQueue("admin@uh.edu");

    expect(result.serviceId).toBeNull();
    expect(result.queue.map((e) => e.userEmail)).toEqual([
      "bob@uh.edu",
      "alice@uh.edu",
    ]);
    // Alice waits for Bob's 30 minute service.
    expect(result.queue[1].estimatedWait).toBe(30);
  });
});

// ---------- model rules ----------

describe("Model rules", () => {
  test("a ticket number can repeat across queues but not inside one", async () => {
    await QueueEntry.create(rawEntry(reset, alice, { ticketNumber: "Q-1" }));

    await expect(
      QueueEntry.create(rawEntry(hardware, alice, { ticketNumber: "Q-1" })),
    ).resolves.toBeTruthy();
    await expect(
      QueueEntry.create(rawEntry(reset, bob, { ticketNumber: "Q-1" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  test("a user can only have one waiting entry per queue", async () => {
    await QueueEntry.create(rawEntry(reset, alice, { ticketNumber: "Q-1" }));

    await expect(
      QueueEntry.create(rawEntry(reset, alice, { ticketNumber: "Q-2" })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  test.each(["canceled", "served"])(
    "a user can have a new waiting entry once the old one is %s",
    async (status) => {
      await QueueEntry.create(
        rawEntry(reset, alice, { ticketNumber: "Q-1", status }),
      );

      await expect(
        QueueEntry.create(rawEntry(reset, alice, { ticketNumber: "Q-2" })),
      ).resolves.toBeTruthy();
    },
  );
});

// ---------- view queue ----------

describe("View queue", () => {
  test("shows only people still waiting in that service, with positions", async () => {
    const left = await join("alice@uh.edu", reset);
    await join("bob@uh.edu", reset);
    await join("carol@uh.edu", reset);
    await join("bob@uh.edu", hardware);
    await leaveQueue("alice@uh.edu", left.id);
    await serveNext("admin@uh.edu", { serviceId: reset.id }); // serves bob

    const result = await viewQueue("admin@uh.edu", reset.id);

    expect(result.success).toBe(true);
    expect(result.serviceId).toBe(reset.id);
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0]).toMatchObject({
      userEmail: "carol@uh.edu",
      serviceName: "Password Reset",
      title: "Cannot connect to Wi-Fi",
      position: 1,
    });
  });

  // viewQueue and serveNext validate the service id the same way.
  test.each([
    ["view queue", (id) => viewQueue("admin@uh.edu", id)],
    ["serve next", (id) => serveNext("admin@uh.edu", { serviceId: id })],
  ])("%s: a bad service id returns 400 and an unknown one 404", async (_n, call) => {
    expect((await call("nope")).status).toBe(400);
    expect((await call(String(new mongoose.Types.ObjectId()))).status).toBe(
      404,
    );
  });
});

// ---------- serve next ----------

describe("Serve next", () => {
  test("serves people in order and saves who served them", async () => {
    const first = await join("alice@uh.edu", reset);
    const second = await join("bob@uh.edu", reset);

    const one = await serveNext("admin@uh.edu", { serviceId: reset.id });
    const two = await serveNext("admin@uh.edu", { serviceId: reset.id });

    expect(one.status).toBe(200);
    expect(one.entry.id).toBe(first.id);
    expect(one.entry.status).toBe("served");
    expect(one.entry.position).toBeNull();
    expect(two.entry.id).toBe(second.id);

    const saved = await QueueEntry.findById(first.id).lean();
    expect(saved.status).toBe("served");
    expect(saved.finishedAt).toBeInstanceOf(Date);
    expect(String(saved.servedBy)).toBe(String(admin._id));
  });

  test("without a service it serves the front of the combined line", async () => {
    await join("alice@uh.edu", reset); // low, first
    const urgent = await join("bob@uh.edu", hardware); // high, later

    const result = await serveNext("admin@uh.edu", {});

    expect(result.status).toBe(200);
    expect(result.entry.id).toBe(urgent.id);
  });

  test("an empty queue returns 404", async () => {
    const result = await serveNext("admin@uh.edu", { serviceId: reset.id });

    expect(result.status).toBe(404);
    expect(result.message).toMatch(/nobody is waiting/i);
  });

  test("two simultaneous calls serve two different people", async () => {
    await join("alice@uh.edu", reset);
    await join("bob@uh.edu", reset);
    await join("carol@uh.edu", reset);

    const results = await Promise.all([
      serveNext("admin@uh.edu", { serviceId: reset.id }),
      serveNext("admin@uh.edu", { serviceId: reset.id }),
    ]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(new Set(results.map((r) => r.entry.id)).size).toBe(2);
    expect(await QueueEntry.countDocuments({ status: "served" })).toBe(2);
    expect(await QueueEntry.countDocuments({ status: "waiting" })).toBe(1);
  });
});

// ---------- my queues ----------

describe("My queues", () => {
  test("positions and waits are counted inside each service's own line", async () => {
    const inReset = await join("alice@uh.edu", reset);
    await join("bob@uh.edu", hardware);
    const inHardware = await join("alice@uh.edu", hardware);

    const result = await listMyQueues("alice@uh.edu");

    expect(result.success).toBe(true);
    // Oldest first.
    expect(result.entries.map((e) => e.id)).toEqual([
      inReset.id,
      inHardware.id,
    ]);
    expect(result.entries[0]).toMatchObject({ position: 1, estimatedWait: 0 });
    // Bob is ahead of Alice for Hardware Repair, which takes 30 minutes.
    expect(result.entries[1]).toMatchObject({
      position: 2,
      peopleAhead: 1,
      estimatedWait: 30,
    });
  });

  test("only shows my own entries that are still waiting", async () => {
    const left = await join("alice@uh.edu", reset);
    await join("alice@uh.edu", hardware);
    await join("bob@uh.edu", reset);
    await leaveQueue("alice@uh.edu", left.id);

    const mine = await listMyQueues("alice@uh.edu");
    const bobs = await listMyQueues("bob@uh.edu");

    expect(mine.entries.map((e) => e.serviceName)).toEqual(["Hardware Repair"]);
    expect(bobs.entries.map((e) => e.serviceName)).toEqual(["Password Reset"]);
  });
});

// ---------- notifications ----------

describe("Notifications", () => {
  test("joining sends a joined notice to that user only", async () => {
    const entry = await join("alice@uh.edu", reset);

    const saved = await Notification.findOne({ userId: alice._id }).lean();
    expect(saved.message).toBe("You joined the Password Reset queue.");
    expect(saved.type).toBe("queue");
    expect(String(saved.entryId)).toBe(entry.id);

    // Position 1 is already inside the "almost up" range.
    expect(await messagesFor(alice)).toContain(
      "You are almost up for Password Reset.",
    );
    expect(await messagesFor(bob)).toHaveLength(0);
  });

  test("someone further back is told once they move into the first spots", async () => {
    const first = await join("alice@uh.edu", reset);
    await join("bob@uh.edu", reset);
    await join("carol@uh.edu", reset); // position 3

    expect(await messagesFor(carol)).toEqual([
      "You joined the Password Reset queue.",
    ]);

    await leaveQueue("alice@uh.edu", first.id); // carol moves to position 2

    expect(await messagesFor(carol)).toContain(
      "You are almost up for Password Reset.",
    );
  });

  test("serving sends a your-turn notice to the right user", async () => {
    const entry = await join("alice@uh.edu", reset);
    await join("bob@uh.edu", reset);

    await serveNext("admin@uh.edu", { serviceId: reset.id });

    const turn = await Notification.findOne({
      userId: alice._id,
      message: /your turn/i,
    }).lean();

    expect(turn).toBeTruthy();
    expect(turn.message).toContain("Password Reset");
    expect(turn.type).toBe("status");
    expect(String(turn.entryId)).toBe(entry.id);

    const bobMessages = await messagesFor(bob);
    expect(bobMessages.some((m) => /your turn/i.test(m))).toBe(false);
  });

  test("failed requests create no notifications", async () => {
    await joinQueue("alice@uh.edu", ticket(installs)); // closed
    await joinQueue("alice@uh.edu", ticket(reset, { title: "" })); // invalid
    await serveNext("admin@uh.edu", { serviceId: reset.id }); // nobody waiting

    expect(await Notification.countDocuments()).toBe(0);
  });
});
