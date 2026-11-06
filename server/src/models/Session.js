import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserCredentials",
    required: true,
  },

  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
});

export default mongoose.models.Session ||
  mongoose.model("Session", sessionSchema);