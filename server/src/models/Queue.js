// Add Queue Model
// This collection represents an active queue for a service
//Replaces isOpen

import mongoose from "mongoose";

const queueSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      required: true,
    },
        ticketCounter: {
          type: Number,
          default: 0,
          min: 0,
        },
  },
  { timestamps: true },
);

export default mongoose.models.Queue ||
  mongoose.model("Queue", queueSchema);