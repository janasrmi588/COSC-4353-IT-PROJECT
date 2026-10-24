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

  test("rejects registration when email is missing", () => {
    const result = registerUser("", "password123");

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.message).toBe("Email and password are required.");

    // Failed registration should not add a user
    expect(users).toHaveLength(2);
    });

    test("rejects registration when password is missing", () => {
    const result = registerUser("newstudent@uh.edu", "");

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.message).toBe("Email and password are required.");

    expect(users).toHaveLength(2);
    });

    test("rejects login for an email that does not exist", () => {
    const result = loginUser("fakeuser@uh.edu", "password123");

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.message).toBe("Invalid email or password.");
    });

    test("handles email addresses regardless of capitalization", () => {
    const result = loginUser("STUDENT@UH.EDU", "student123");

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.user.email).toBe("student@uh.edu");
    });

    test("does not return a user's password after successful login", () => {
    const result = loginUser("student@uh.edu", "student123");

    expect(result.success).toBe(true);
    expect(result.user).not.toHaveProperty("password");
    });
});