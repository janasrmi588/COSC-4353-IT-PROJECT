import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";

import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  test,
  expect,
} from "vitest";

import UserCredentials from "../src/models/UserCredentials.js";
import Session from "../src/models/Session.js";

import {
  registerUser,
  loginUser,
  hashToken,
} from "../src/modules/auth/auth.service.js";

let mongo;
let fixtureHash;

beforeAll(async () => {
  // Separate temporary database; does not use your .env database.
  mongo = await MongoMemoryServer.create();

  await mongoose.connect(mongo.getUri(), {
    dbName: "auth_tests",
  });

  await UserCredentials.init();
  await Session.init();

  // Low cost is only for test fixtures.
  // The real registration function keeps its normal hashing cost.
  fixtureHash = await bcrypt.hash("password123", 4);
}, 60000);

beforeEach(async () => {
  await Session.deleteMany({});
  await UserCredentials.deleteMany({});

  await UserCredentials.create([
    {
      email: "student@uh.edu",
      passwordHash: fixtureHash,
      role: "user",
    },
    {
      email: "admin@uh.edu",
      passwordHash: fixtureHash,
      role: "administrator",
    },
  ]);
}, 20000);

afterAll(async () => {
  await mongoose.disconnect();

  if (mongo) {
    await mongo.stop();
  }
}, 60000);

describe("Authentication", () => {
  test("registers a user and saves a hashed password", async () => {
    const result = await registerUser(
      "newstudent@uh.edu",
      "password123",
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(201);
    expect(result.user).toMatchObject({
      email: "newstudent@uh.edu",
      role: "user",
    });

    const stored = await UserCredentials.findOne({
      email: "newstudent@uh.edu",
    }).select("+passwordHash");

    expect(stored).not.toBeNull();
    expect(stored.passwordHash).not.toBe("password123");

    expect(
      await bcrypt.compare("password123", stored.passwordHash),
    ).toBe(true);

    expect(result.user).not.toHaveProperty("passwordHash");
  }, 20000);

  test("rejects duplicate registration", async () => {
    const result = await registerUser(
      "STUDENT@UH.EDU",
      "password123",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(409);
    expect(await UserCredentials.countDocuments()).toBe(2);
  }, 20000);

  test("logs in a student and creates a session", async () => {
    const result = await loginUser(
      "student@uh.edu",
      "password123",
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.user.role).toBe("user");
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);

    const session = await Session.findOne({
      tokenHash: hashToken(result.token),
    });

    expect(session).not.toBeNull();
    expect(String(session.userId)).toBe(result.user.id);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(session.tokenHash).not.toBe(result.token);
  });

  test("logs in an administrator", async () => {
    const result = await loginUser(
      "admin@uh.edu",
      "password123",
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.user.role).toBe("administrator");
  });

  test("rejects an incorrect password", async () => {
    const result = await loginUser(
      "student@uh.edu",
      "wrongpassword",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(await Session.countDocuments()).toBe(0);
  });

  test("rejects missing login information", async () => {
    const result = await loginUser("", "");

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  test("rejects registration without an email", async () => {
    const result = await registerUser("", "password123");

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(await UserCredentials.countDocuments()).toBe(2);
  });

  test("rejects registration without a password", async () => {
    const result = await registerUser("newstudent@uh.edu", "");

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(await UserCredentials.countDocuments()).toBe(2);
  });

  test("rejects login for an unknown account", async () => {
    const result = await loginUser(
      "unknown@uh.edu",
      "password123",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });

  test("normalizes email capitalization and spaces", async () => {
    const result = await loginUser(
      "  STUDENT@UH.EDU  ",
      "password123",
    );

    expect(result.success).toBe(true);
    expect(result.user.email).toBe("student@uh.edu");
  });

  test("does not return password information", async () => {
    const result = await loginUser(
      "student@uh.edu",
      "password123",
    );

    expect(result.success).toBe(true);
    expect(result.user).not.toHaveProperty("password");
    expect(result.user).not.toHaveProperty("passwordHash");
  });
});