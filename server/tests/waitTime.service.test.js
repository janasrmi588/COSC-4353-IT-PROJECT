import mongoose from "mongoose";
import { describe, expect, test } from "vitest";

import { estimateWait } from "../src/modules/waitTime/waitTime.service.js";

const services = [
    { id: "a1", expectedDuration: 10 },
    { id: "b2", expectedDuration: 15 },
    { id: "c3", expectedDuration: 20 },
];

const line = [{ serviceId: "a1" }, { serviceId: "b2" }, { serviceId: "c3" }];

describe("estimateWait", () => {
    test("adds up the expected duration of everyone ahead", () => {
        expect(estimateWait(line, 0, services)).toBe(0);
        expect(estimateWait(line, 1, services)).toBe(10);
        expect(estimateWait(line, 2, services)).toBe(25);
    });

    test("does not count the person being estimated", () => {
        expect(estimateWait(line, 2, services)).toBe(10 + 15);
    });

    test("matches ids whether they are ObjectIds or strings", () => {
        const first = new mongoose.Types.ObjectId();
        const second = new mongoose.Types.ObjectId();

        const entries = [{ serviceId: first }, { serviceId: second }, { serviceId: first }];
        const asDocuments = [
            { _id: first, expectedDuration: 12 },
            { _id: second, expectedDuration: 7 },
        ];
        const asApiObjects = [
            { id: String(first), expectedDuration: 12 },
            { id: String(second), expectedDuration: 7 },
        ];

        expect(estimateWait(entries, 2, asDocuments)).toBe(19);
        expect(estimateWait(entries, 2, asApiObjects)).toBe(19);
    });

    test("counts an entry as 0 when its service is not in the list", () => {
        const entries = [{ serviceId: "missing" }, { serviceId: "a1" }];

        expect(estimateWait(entries, 2, services)).toBe(10);
    });

    test("counts 0 for a service with no usable duration", () => {
        const list = [{ id: "a1" }, { id: "b2", expectedDuration: "soon" }];

        expect(estimateWait(line, 2, list)).toBe(0);
    });

    test("returns 0 when no service list is given", () => {
        expect(estimateWait(line, 2)).toBe(0);
    });

    test("does not fail when the index is past the end of the line", () => {
        expect(estimateWait(line, 10, services)).toBe(45);
        expect(estimateWait([], 3, services)).toBe(0);
    });

    test("returns 0 for the front of the line and for a negative index", () => {
        expect(estimateWait(line, 0, services)).toBe(0);
        expect(estimateWait(line, -1, services)).toBe(0);
    });
});
