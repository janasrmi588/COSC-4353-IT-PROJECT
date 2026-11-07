import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import Queue from "../src/models/Queue.js";
import Service from "../src/models/Service.js";
import UserCredentials from "../src/models/UserCredentials.js";
import UserProfile from "../src/models/UserProfile.js";
import {
  DEMO_USERS,
  STARTER_SERVICES,
  seedDatabase,
} from "../src/seed/seed.js";


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

  await Promise.all(
    [UserCredentials, UserProfile, Service, Queue].map((m) => m.init()),
  );
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


describe("Seed", () => {
  test("creates the demo accounts with encrypted passwords", async () => {
    const added = await seedDatabase();

    expect(added.users).toBe(DEMO_USERS.length);
    for (const demo of DEMO_USERS) {
      const user = await UserCredentials.findOne({
        email: demo.email,
      }).select("+passwordHash");

      expect(user.role).toBe(demo.role);
      expect(user.passwordHash).not.toBe(demo.password);
      expect(await bcrypt.compare(demo.password, user.passwordHash)).toBe(true);
    }
  });

  test("creates one profile for each account", async () => {
    const added = await seedDatabase();

    expect(added.profiles).toBe(DEMO_USERS.length);
    const users = await UserCredentials.find().lean();
    for (const user of users) {
      expect(await UserProfile.countDocuments({ userId: user._id })).toBe(1);
    }
  });

  test("creates the starter services, each with a queue", async () => {
    const added = await seedDatabase();

    expect(added.services).toBe(STARTER_SERVICES.length);
    expect(added.queues).toBe(STARTER_SERVICES.length);

    for (const demo of STARTER_SERVICES) {
      const service = await Service.findOne({ name: demo.name }).lean();
      const queue = await Queue.findOne({ serviceId: service._id }).lean();

      expect(queue.status).toBe(demo.status);
      expect(queue.ticketCounter).toBe(0);
    }
    const closed = await Queue.countDocuments({ status: "closed" });
    expect(closed).toBe(1);
  });

  test("running it twice adds nothing the second time", async () => {
    await seedDatabase();

    const again = await seedDatabase();

    expect(again).toEqual({ users: 0, profiles: 0, services: 0, queues: 0 });
    expect(await UserCredentials.countDocuments()).toBe(DEMO_USERS.length);
    expect(await UserProfile.countDocuments()).toBe(DEMO_USERS.length);
    expect(await Service.countDocuments()).toBe(STARTER_SERVICES.length);
    expect(await Queue.countDocuments()).toBe(STARTER_SERVICES.length);
  });

  test("leaves existing data alone", async () => {
    await seedDatabase();
    await UserCredentials.updateOne(
      { email: "student@uh.edu" },
      { passwordHash: "changed-by-the-user" },
    );
    const service = await Service.findOne({ name: "Password Reset" });
    await Queue.updateOne(
      { serviceId: service._id },
      { status: "closed", ticketCounter: 7 },
    );

    await seedDatabase();

    const student = await UserCredentials.findOne({
      email: "student@uh.edu",
    }).select("+passwordHash");
    expect(student.passwordHash).toBe("changed-by-the-user");

    const queue = await Queue.findOne({ serviceId: service._id }).lean();
    expect(queue.status).toBe("closed");
    expect(queue.ticketCounter).toBe(7);
  });

  test("fills in a missing queue for a service that already exists", async () => {
    await Service.create({
      name: "password reset",
      description: "Created by hand.",
      expectedDuration: 5,
      priority: "low",
    });

    const added = await seedDatabase();

    expect(added.services).toBe(STARTER_SERVICES.length - 1);
    expect(added.queues).toBe(STARTER_SERVICES.length);
    expect(await Service.countDocuments()).toBe(STARTER_SERVICES.length);
  });
});
