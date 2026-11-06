import mongoose from "mongoose";

export const PRIORITY_LEVELS = ["low", "medium", "high"];
export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;
export const DURATION_MIN = 1;
export const DURATION_MAX = 480;

const durationMessage = `Expected duration must be between ${DURATION_MIN} and ${DURATION_MAX} minutes.`;

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Service name is required."],
      trim: true,
      maxlength: [
        NAME_MAX_LENGTH,
        `Service name must be ${NAME_MAX_LENGTH} characters or fewer.`,
      ],
    },
    nameKey: { type: String, unique: true },
    description: {
      type: String,
      required: [true, "Description is required."],
      trim: true,
      maxlength: [
        DESCRIPTION_MAX_LENGTH,
        `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      ],
    },
    expectedDuration: {
      type: Number,
      required: [true, "Expected duration is required."],
      min: [DURATION_MIN, durationMessage],
      max: [DURATION_MAX, durationMessage],
      validate: {
        validator: Number.isInteger,
        message: "Expected duration must be a whole number of minutes.",
      },
    },
    priority: {
      type: String,
      required: [true, "Priority level is required."],
      enum: {
        values: PRIORITY_LEVELS,
        message: `Priority level must be one of: ${PRIORITY_LEVELS.join(", ")}.`,
      },
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.nameKey;
        return ret;
      },
    },
  },
);

serviceSchema.pre("validate", function setNameKey() {
  this.nameKey =
    typeof this.name === "string" ? this.name.trim().toLowerCase() : undefined;
});

const Service =
  mongoose.models.Service || mongoose.model("Service", serviceSchema);

export default Service;
