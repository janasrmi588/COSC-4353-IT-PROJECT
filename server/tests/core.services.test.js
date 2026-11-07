import { beforeEach, describe, expect, test, vi } from "vitest";

import { services, queueEntries } from "../src/data/store.js";

import { estimateWait } from "../src/modules/waitTime/waitTime.service.js";

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
