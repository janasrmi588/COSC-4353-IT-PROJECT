import mongoose from "mongoose";
import { afterEach, describe, expect, test, vi } from "vitest";
import { connectDatabase, disconnectDatabase } from "../src/db/connect.js";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe("connectDatabase", () => {
    test("stops with a clear message when MONGODB_URI is missing", async () => {
        const connect = vi.spyOn(mongoose, "connect");

        await expect(connectDatabase("")).rejects.toThrow(/MONGODB_URI is not set/);
        await expect(connectDatabase("   ")).rejects.toThrow(/MONGODB_URI/);
        expect(connect).not.toHaveBeenCalled();
    });

    test("reads the connection string from the environment by default", async () => {
        vi.stubEnv("MONGODB_URI", "mongodb://example.test/queuesmart");
        const connect = vi.spyOn(mongoose, "connect").mockResolvedValue(mongoose);

        await connectDatabase();

        expect(connect).toHaveBeenCalledWith(
            "mongodb://example.test/queuesmart",
            expect.anything(),
        );
    });

    test("connects with the given string and a short timeout", async () => {
        const connect = vi.spyOn(mongoose, "connect").mockResolvedValue(mongoose);

        const connection = await connectDatabase(
            "  mongodb://example.test/queuesmart  ",
        );

        expect(connect).toHaveBeenCalledWith("mongodb://example.test/queuesmart", {
            serverSelectionTimeoutMS: 10000,
        });
        expect(connection).toBe(mongoose.connection);
    });

    test("lets a connection failure through so the server can stop", async () => {
        vi.spyOn(mongoose, "connect").mockRejectedValue(new Error("unreachable"));

        await expect(connectDatabase("mongodb://example.test/x")).rejects.toThrow(
            "unreachable",
        );
    });

    test("registers the models when it is imported", () => {
        expect(mongoose.modelNames()).toEqual(
            expect.arrayContaining(["Service", "Notification"]),
        );
    });
});

describe("disconnectDatabase", () => {
    test("closes the Mongoose connection", async () => {
        const disconnect = vi.spyOn(mongoose, "disconnect").mockResolvedValue();

        await disconnectDatabase();

        expect(disconnect).toHaveBeenCalledTimes(1);
    });
});
