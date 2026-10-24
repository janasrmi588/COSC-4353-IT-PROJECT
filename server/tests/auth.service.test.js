import { beforeEach, describe, expect, test } from "vitest";
import {
  loginUser,
  registerUser,
} from "../src/modules/auth/auth.service.js";
import { users } from "../src/data/store.js";

const originalUsers = [
  {
    id: 1,
    email: "student@uh.edu",
    password: "student123",
    role: "user",
  },
  {
    id: 2,
    email: "admin@uh.edu",
    password: "admin123",
    role: "administrator",
  },
];

beforeEach(() => {
  users.length = 0;

  originalUsers.forEach((user) => {
    users.push({ ...user });
  });
});

describe("Authentication", () => {
  test("registers a new user successfully", () => {
    const result = registerUser(
      "newstudent@uh.edu",
      "password123"
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(201);
    expect(result.user.email).toBe("newstudent@uh.edu");
    expect(result.user.role).toBe("user");
    expect(users).toHaveLength(3);
  });

  test("rejects duplicate registration", () => {
    const result = registerUser(
      "student@uh.edu",
      "password123"
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(409);
    expect(users).toHaveLength(2);
  });

  test("logs in a student with correct credentials", () => {
    const result = loginUser(
      "student@uh.edu",
      "student123"
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.user.role).toBe("user");
  });

  test("logs in an administrator with administrator role", () => {
    const result = loginUser(
      "admin@uh.edu",
      "admin123"
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.user.role).toBe("administrator");
  });

  test("rejects an incorrect password", () => {
    const result = loginUser(
      "student@uh.edu",
      "wrongpassword"
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });

  test("rejects missing login information", () => {
    const result = loginUser("", "");

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });
});