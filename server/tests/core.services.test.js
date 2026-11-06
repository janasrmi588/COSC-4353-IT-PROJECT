import { beforeEach, describe, expect, test, vi } from "vitest";

import { services, queueEntries } from "../src/data/store.js";

import { estimateWait } from "../src/modules/waitTime/waitTime.service.js";
import { listHistory } from "../src/modules/history/history.service.js";

import {
  compareEntries,
  joinQueue,
  leaveQueue,
  listMyQueues,
  serveNext,
  viewQueue,
} from "../src/modules/queue/queue.service.js";

const originalServices = services.map((item) => ({ ...item }));
const originalEntries = queueEntries.map((item) => ({ ...item }));

beforeEach(() => {
  services.splice(
    0,
    services.length,
    ...originalServices.map((item) => ({ ...item })),
  );

  queueEntries.splice(
    0,
    queueEntries.length,
    ...originalEntries.map((item) => ({ ...item })),
  );

  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("Wait Time", () => {
  test("calculates wait time based on people ahead", () => {
    const line = [{ serviceId: 1 }, { serviceId: 2 }, { serviceId: 3 }];

    expect(estimateWait(line, 2)).toBe(20);
    expect(estimateWait(line, 0)).toBe(0);
  });
});

describe("History", () => {
  test("returns only finished queues for a user", () => {
    const result = listHistory("student@uh.edu");

    expect(result.success).toBe(true);
    expect(result.history.length).toBe(2);

    expect(
      result.history.every((entry) =>
        ["served", "canceled"].includes(entry.status),
      ),
    ).toBe(true);
  });

  test("rejects history request for unknown user", () => {
    expect(listHistory("nobody@uh.edu").status).toBe(401);
  });
});

describe("Queue Management", () => {
  test("higher priority users are ordered first", () => {
    const low = {
      id: 1,
      priority: "low",
      joinedAt: "2026-01-01T09:00:00Z",
    };

    const high = {
      id: 2,
      priority: "high",
      joinedAt: "2026-01-01T10:00:00Z",
    };

    expect(compareEntries(high, low)).toBeLessThan(0);
  });

  test("user can join an open queue", () => {
    const result = joinQueue("student@uh.edu", { serviceId: 3 });

    expect(result.status).toBe(201);
    expect(result.entry.status).toBe("waiting");

    const myQueues = listMyQueues("student@uh.edu");

    expect(myQueues.entries.some((entry) => entry.id === result.entry.id)).toBe(
      true,
    );
  });

  test("user cannot join a closed service", () => {
    const result = joinQueue("student@uh.edu", { serviceId: 4 });

    expect(result.status).toBe(409);
  });

  test("user cannot join the same queue twice", () => {
    const result = joinQueue("student@uh.edu", { serviceId: 1 });

    expect(result.status).toBe(409);
  });

  test("user can leave a queue", () => {
    const result = leaveQueue("student@uh.edu", 3);

    expect(result.status).toBe(200);
    expect(result.entry.status).toBe("canceled");
  });

  test("administrator can view the queue", () => {
    const result = viewQueue("admin@uh.edu", 1);

    expect(result.success).toBe(true);
    expect(result.queue.length).toBeGreaterThan(0);
  });

  test("administrator can serve the next user", () => {
    const result = serveNext("admin@uh.edu", { serviceId: 1 });

    expect(result.status).toBe(200);
    expect(result.entry.status).toBe("served");
    expect(result.entry.servedBy).toBe("admin@uh.edu");
  });

  test("users and administrators have different queue permissions", () => {
    expect(joinQueue("admin@uh.edu", { serviceId: 1 }).status).toBe(403);

    expect(viewQueue("student@uh.edu", 1).status).toBe(403);
  });
});
