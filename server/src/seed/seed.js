import bcrypt from "bcryptjs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import Queue from "../models/Queue.js";
import Service from "../models/Service.js";
import UserCredentials from "../models/UserCredentials.js";
import UserProfile from "../models/UserProfile.js";

const BCRYPT_ROUNDS = 10;

// Both passwords are at least 8 characters, so they also meet the register rule.
export const DEMO_USERS = [
  {
    email: "student@uh.edu",
    password: "student123",
    role: "user",
    name: "Demo Student",
  },
  {
    email: "admin@uh.edu",
    password: "admin123",
    role: "administrator",
    name: "Demo Admin",
  },
];

export const STARTER_SERVICES = [
  {
    name: "Password Reset",
    description: "Reset or unlock your university account.",
    expectedDuration: 10,
    priority: "high",
    status: "open",
  },
  {
    name: "Wi-Fi / Network Help",
    description: "Help connecting to campus Wi-Fi or the VPN.",
    expectedDuration: 15,
    priority: "high",
    status: "open",
  },
  {
    name: "Software Install Request",
    description: "Request or troubleshoot licensed software.",
    expectedDuration: 20,
    priority: "medium",
    status: "open",
  },
  {
    name: "Hardware Repair",
    description: "Help with laptop, printer, and computer issues.",
    expectedDuration: 30,
    priority: "medium",
    status: "closed",
  },
];

// The profile's name field is called fullName in the agreed design. Use it if
// the model has it, otherwise fall back to the older displayName.
function profileNameField() {
  return UserProfile.schema.path("fullName") ? "fullName" : "displayName";
}

// Adds whatever demo data is missing and returns how much it added.
// Expects Mongoose to be connected already.
export async function seedDatabase() {
  const added = { users: 0, profiles: 0, services: 0, queues: 0 };
  const nameField = profileNameField();

  await Promise.all([
    UserCredentials.init(),
    UserProfile.init(),
    Service.init(),
    Queue.init(),
  ]);

  for (const demo of DEMO_USERS) {
    let user = await UserCredentials.findOne({ email: demo.email });

    if (!user) {
      user = await UserCredentials.create({
        email: demo.email,
        passwordHash: await bcrypt.hash(demo.password, BCRYPT_ROUNDS),
        role: demo.role,
      });
      added.users += 1;
    }

    const profile = await UserProfile.updateOne(
      { userId: user._id },
      { $setOnInsert: { [nameField]: demo.name } },
      { upsert: true },
    );
    added.profiles += profile.upsertedCount;
  }

  for (const item of STARTER_SERVICES) {
    const nameKey = item.name.trim().toLowerCase();

    let service = await Service.findOne({ nameKey });

    if (!service) {
      service = await Service.create({
        name: item.name,
        description: item.description,
        expectedDuration: item.expectedDuration,
        priority: item.priority,
      });
      added.services += 1;
    }


    const queue = await Queue.updateOne(
      { serviceId: service._id },
      {
        $setOnInsert: {
          status: item.status,
          ticketCounter: 0,
        },
      },
      { upsert: true, runValidators: true },
    );
    added.queues += queue.upsertedCount;
  }

  return added;
}


async function main() {
  try {
    await connectDatabase();
    const added = await seedDatabase();

    console.log(
      `Seed finished. Added ${added.users} users, ${added.profiles} profiles, ` +
        `${added.services} services and ${added.queues} queues.`,
    );
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

const startedDirectly =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase() ===
    import.meta.url.toLowerCase();

if (startedDirectly) {
  await main();
}
