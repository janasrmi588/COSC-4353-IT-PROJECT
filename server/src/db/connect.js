import mongoose from "mongoose";

// Importing this file also registers every model with Mongoose (see
// models/index.js), so anything that connects can use all of them.
import "../models/index.js";

// How long to wait for the database before giving up, in milliseconds.
// Without this, a wrong string or a blocked network hangs for 30 seconds.
const SERVER_SELECTION_TIMEOUT_MS = 10000;

// Connects Mongoose to MongoDB Atlas. The connection string comes from the
// MONGODB_URI environment variable (see server/.env.example) and is never
// written to the logs.
export async function connectDatabase(uri = process.env.MONGODB_URI) {
    if (typeof uri !== "string" || !uri.trim()) {
        throw new Error(
            "MONGODB_URI is not set. Copy server/.env.example to server/.env and add the connection string.",
        );
    }

    await mongoose.connect(uri.trim(), {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });

    return mongoose.connection;
}

export async function disconnectDatabase() {
    await mongoose.disconnect();
}
