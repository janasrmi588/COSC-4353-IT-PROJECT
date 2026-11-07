import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

import UserCredentials from "../../models/UserCredentials.js";
import Session from "../../models/Session.js";

function fail(status, message) {
  return { success: false, status, message };
}

function normalizeEmail(email) {
  return typeof email === "string"
    ? email.trim().toLowerCase()
    : "";
}

// Only return information the frontend needs.
export function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
  };
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(email, password) {
  email = normalizeEmail(email);

  if (!email || typeof password !== "string" || !password) {
    return fail(400, "Email and password are required.");
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return fail(400, "Enter a valid email address.");
  }

  if (
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return fail(
      400,
      "Password must be at least 8 characters and at most 72 UTF-8 bytes.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await UserCredentials.create({
      email,
      passwordHash,
      role: "user",
    });

    return {
      success: true,
      status: 201,
      user: publicUser(user),
    };
  } catch (error) {
    if (error.code === 11000) {
      return fail(
        409,
        "An account with this email already exists.",
      );
    }

    throw error;
  }
}

export async function loginUser(email, password) {
  email = normalizeEmail(email);

  if (!email || typeof password !== "string" || !password) {
    return fail(400, "Email and password are required.");
  }

  if (
    email.length > 254 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return fail(401, "Invalid email or password.");
  }

  // passwordHash is hidden by default in the model.
  const user = await UserCredentials.findOne({ email })
    .select("+passwordHash");

  if (
    !user ||
    !user.passwordHash ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    return fail(401, "Invalid email or password.");
  }

  // The browser receives the token; MongoDB stores only its hash.
  const token = randomBytes(32).toString("hex");

  await Session.create({
    tokenHash: hashToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  });

  return {
    success: true,
    status: 200,
    user: publicUser(user),
    token,
  };
}