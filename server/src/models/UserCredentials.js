// Add UserCredentials model
// This collection stores authentication-related information
import mongoose from "mongoose";

const userCredentialsSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      maxlength: 254,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "administrator"],
      default: "user",
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.UserCredentials ||
  mongoose.model("UserCredentials", userCredentialsSchema);