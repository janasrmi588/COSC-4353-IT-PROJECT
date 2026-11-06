// add Notification/History model
// From the A4 assignment, this collection tracks system activity
// Reference users by User ID, not by email.
import mongoose from "mongoose";

export const NOTIFICATION_TYPES = ["status", "queue"];
export const NOTIFICATION_STATUSES = ["sent", "viewed"];
export const MESSAGE_MAX_LENGTH = 500;

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCredentials",
      required: [true, "A user is required."],
      index: true,
    },
    // The queue entry this is about; null for general notices.
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QueueEntry",
      default: null,
    },
    type: {
      type: String,
      required: [true, "A notification type is required."],
      enum: {
        values: NOTIFICATION_TYPES,
        message: `Type must be one of: ${NOTIFICATION_TYPES.join(", ")}.`,
      },
    },
    message: {
      type: String,
      required: [true, "A notification message is required."],
      trim: true,
      maxlength: [
        MESSAGE_MAX_LENGTH,
        `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer.`,
      ],
    },
    status: {
      type: String,
      enum: {
        values: NOTIFICATION_STATUSES,
        message: `Status must be one of: ${NOTIFICATION_STATUSES.join(", ")}.`,
      },
      default: "sent",
    },
    // The "timestamp".
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
