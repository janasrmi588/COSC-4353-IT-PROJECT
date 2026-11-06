// Add UserProfile model
// this collection stores user-related details

import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCredentials",
      required: true,
      unique: true,
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
  },
  { timestamps: true },
);

export default mongoose.models.UserProfile ||
  mongoose.model("UserProfile", userProfileSchema);