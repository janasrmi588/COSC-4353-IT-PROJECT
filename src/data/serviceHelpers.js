export const NAME_MAX_LENGTH = 100;

export const PRIORITY_LEVELS = ["low", "medium", "high"];

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const EMPTY_SERVICE_FORM = {
  name: "",
  description: "",
  expectedDuration: "",
  priority: "medium",
};

export function validateService(values) {
  const errors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Service name is required.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Service name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!values.description.trim()) {
    errors.description = "Description is required.";
  }

  const duration = String(values.expectedDuration).trim();
  if (!duration) {
    errors.expectedDuration = "Expected duration is required.";
  } else if (!/^\d+$/.test(duration) || Number(duration) < 1) {
    errors.expectedDuration = "Enter a whole number of minutes, 1 or more.";
  }

  if (!PRIORITY_LEVELS.includes(values.priority)) {
    errors.priority = "Choose a priority level.";
  }

  return errors;
}
