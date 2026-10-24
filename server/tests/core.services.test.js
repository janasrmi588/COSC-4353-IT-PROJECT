import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  services,
  queueEntries,
  notifications,
} from "../src/data/store.js";

import { estimateWait } from "../src/modules/waitTime/waitTime.service.js";
import { listHistory } from "../src/modules/history/history.service.js";

import {
  createNotification,
  listNotifications,
  markNotificationRead,
  notifyAlmostReady,
} from "../src/modules/notifications/notifications.service.js";

import {
  createService,
  deleteService,
  getServiceById,
  updateService,
  validateServiceInput,
} from "../src/modules/services/services.service.js";

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
const originalNotifications = notifications.map((item) => ({ ...item }));

beforeEach(() => {
  services.splice(
    0,
    services.length,
    ...originalServices.map((item) => ({ ...item }))
  );

  queueEntries.splice(
    0,
    queueEntries.length,
    ...originalEntries.map((item) => ({ ...item }))
  );

  notifications.splice(
    0,
    notifications.length,
    ...originalNotifications.map((item) => ({ ...item }))
  );

  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("Wait Time", () => {
  test("calculates wait time based on people ahead", () => {
    const line = [
      { serviceId: 1 },
      { serviceId: 2 },
      { serviceId: 3 },
    ];

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
        ["served", "canceled"].includes(entry.status)
      )
    ).toBe(true);
  });

  test("rejects history request for unknown user", () => {
    expect(listHistory("nobody@uh.edu").status).toBe(401);
  });
});

describe("Notifications", () => {
  test("creates, lists, and marks a notification as read", () => {
    const created = createNotification({
      userEmail: "student@uh.edu",
      entryId: 3,
      type: "queue",
      message: "Test notification",
    });

    expect(created.status).toBe(201);

    const listed = listNotifications("student@uh.edu");

    expect(
      listed.notifications.some(
        (notification) =>
          notification.id === created.notification.id
      )
    ).toBe(true);

    const marked = markNotificationRead(
      "student@uh.edu",
      created.notification.id
    );

    expect(marked.success).toBe(true);
    expect(marked.notification.read).toBe(true);
  });

  test("rejects invalid notification information", () => {
    expect(
      createNotification({
        message: "hello",
      }).status
    ).toBe(400);

    expect(
      createNotification({
        userEmail: "student@uh.edu",
        message: "",
      }).status
    ).toBe(400);

    expect(
      createNotification({
        userEmail: "student@uh.edu",
        message: "hello",
        type: "invalid",
      }).status
    ).toBe(400);
  });

  test("does not create duplicate almost-ready notifications", () => {
    const first = notifyAlmostReady({
      userEmail: "student@uh.edu",
      entryId: 99,
      serviceName: "Password Reset",
    });

    const second = notifyAlmostReady({
      userEmail: "student@uh.edu",
      entryId: 99,
      serviceName: "Password Reset",
    });

    expect(first.success).toBe(true);
    expect(second.duplicate).toBe(true);
  });
});

describe("Service Management", () => {
  const validService = {
    name: "Device Setup",
    description: "Help configure a device.",
    expectedDuration: 20,
    priority: "medium",
    isOpen: true,
  };

  test("validates required service fields", () => {
    const result = validateServiceInput({});

    expect(result.errors.name).toBeDefined();
    expect(result.errors.description).toBeDefined();
    expect(result.errors.expectedDuration).toBeDefined();
    expect(result.errors.priority).toBeDefined();
  });

  test("administrator can create, update, and delete a service", () => {
    const created = createService(
      "admin@uh.edu",
      validService
    );

    expect(created.status).toBe(201);

    const updated = updateService(
      "admin@uh.edu",
      created.service.id,
      {
        ...validService,
        name: "Updated Device Setup",
        isOpen: false,
      }
    );

    expect(updated.status).toBe(200);
    expect(updated.service.name).toBe("Updated Device Setup");
    expect(updated.service.isOpen).toBe(false);

    expect(
      getServiceById(created.service.id).success
    ).toBe(true);

    const deleted = deleteService(
      "admin@uh.edu",
      created.service.id
    );

    expect(deleted.status).toBe(200);

    expect(
      getServiceById(created.service.id).status
    ).toBe(404);
  });

  test("normal user cannot manage services", () => {
    const result = createService(
      "student@uh.edu",
      validService
    );

    expect(result.status).toBe(403);
  });

  test("rejects duplicate service names", () => {
    const result = createService("admin@uh.edu", {
      ...validService,
      name: "Password Reset",
    });

    expect(result.status).toBe(409);
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
    const result = joinQueue(
      "student@uh.edu",
      { serviceId: 3 }
    );

    expect(result.status).toBe(201);
    expect(result.entry.status).toBe("waiting");

    const myQueues = listMyQueues("student@uh.edu");

    expect(
      myQueues.entries.some(
        (entry) => entry.id === result.entry.id
      )
    ).toBe(true);
  });

  test("user cannot join a closed service", () => {
    const result = joinQueue(
      "student@uh.edu",
      { serviceId: 4 }
    );

    expect(result.status).toBe(409);
  });

  test("user cannot join the same queue twice", () => {
    const result = joinQueue(
      "student@uh.edu",
      { serviceId: 1 }
    );

    expect(result.status).toBe(409);
  });

  test("user can leave a queue", () => {
    const result = leaveQueue(
      "student@uh.edu",
      3
    );

    expect(result.status).toBe(200);
    expect(result.entry.status).toBe("canceled");
  });

  test("administrator can view the queue", () => {
    const result = viewQueue(
      "admin@uh.edu",
      1
    );

    expect(result.success).toBe(true);
    expect(result.queue.length).toBeGreaterThan(0);
  });

  test("administrator can serve the next user", () => {
    const result = serveNext(
      "admin@uh.edu",
      { serviceId: 1 }
    );

    expect(result.status).toBe(200);
    expect(result.entry.status).toBe("served");
    expect(result.entry.servedBy).toBe("admin@uh.edu");
  });

  test("users and administrators have different queue permissions", () => {
    expect(
      joinQueue("admin@uh.edu", { serviceId: 1 }).status
    ).toBe(403);

    expect(
      viewQueue("student@uh.edu", 1).status
    ).toBe(403);
  });
});