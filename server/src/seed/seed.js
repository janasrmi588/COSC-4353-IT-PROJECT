// Put the demo data here so everyone can get the same starting data in
// their database. Passwords must be encrypted before they are stored.

import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import Service from "../models/Service.js";
import Queue from "../models/Queue.js";

const starterServices = [
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

async function seed() {
  try {
    await connectDatabase();

    await Promise.all([
      Service.init(),
      Queue.init(),
    ]);

    for (const item of starterServices) {
      const nameKey = item.name.trim().toLowerCase();

      let service = await Service.findOne({ nameKey });

      if (!service) {
        service = await Service.create({
          name: item.name,
          description: item.description,
          expectedDuration: item.expectedDuration,
          priority: item.priority,
        });
      }

      // Create a queue only if this service doesn't already have one.
      // Existing queue status and ticket counter stay unchanged.
      await Queue.updateOne(
        { serviceId: service._id },
        {
          $setOnInsert: {
            status: item.status,
            ticketCounter: 0,
          },
        },
        { upsert: true, runValidators: true },
      );

      console.log(`Ready: ${service.name}`);
    }

    console.log("Starter services added successfully.");
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

seed();