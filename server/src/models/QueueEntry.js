// Add QueueEntry model
// This collection tracks users waiting in a queue
// Reference a user by User ID, not by email

import mongoose from "mongoose";

const queueEntrySchema = new mongoose.Schema({
  queueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Queue",
    required: true,
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },

  // Preserve the name so history still works after service changes.
  serviceName: {
    type: String,
    required: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserCredentials",
    required: true,
  },

  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  ticketNumber: {
    type: String,
    required: true,
  },

  title: {
    type: String,
    trim: true,
    required: true,
    maxlength: 150,
  },

  description: {
    type: String,
    trim: true,
    required: true,
    maxlength: 2000,
  },

  status: {
    type: String,
    enum: ["waiting", "served", "canceled"],
    default: "waiting",
    required: true,
  },

  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    required: true,
  },

  // Supports administrator reordering within a priority group.
  sortOrder: {
    type: Number,
    default: Date.now,
  },

  joinedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },

  finishedAt: {
    type: Date,
    default: null,
  },

  servedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserCredentials",
  },
});

// A user cannot have two waiting tickets in the same queue.
// Finished tickets do not prevent them from joining again.
queueEntrySchema.index(
  { userId: 1, queueId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "waiting" },
  },
);

// The same ticket number may exist in different queues, but never twice in one.
queueEntrySchema.index({ queueId: 1, ticketNumber: 1 }, { unique: true });

queueEntrySchema.index({
  queueId: 1,
  status: 1,
  joinedAt: 1,
});

export default mongoose.models.QueueEntry ||
  mongoose.model("QueueEntry", queueEntrySchema);