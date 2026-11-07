import QueueEntry from "../../models/QueueEntry.js";
import UserCredentials from "../../models/UserCredentials.js";

export const FINISHED_STATUSES = ["served", "canceled"];

export async function listHistory(userEmail) {
  const email =
    typeof userEmail === "string"
      ? userEmail.trim().toLowerCase()
      : "";

  if (!email) {
    return {
      success: false,
      status: 401,
      message: "Please log in first.",
    };
  }

  const user = await UserCredentials.findOne({ email });

  if (!user) {
    return {
      success: false,
      status: 401,
      message: "Please log in first.",
    };
  }

  const entries = await QueueEntry.find({
    userId: user._id,
    status: { $in: FINISHED_STATUSES },
  })
    .sort({ finishedAt: -1, _id: -1 })
    .lean();

  const history = entries.map((entry) => {
    const joinedAt = new Date(entry.joinedAt).toISOString();

    const finishedAt = entry.finishedAt
      ? new Date(entry.finishedAt).toISOString()
      : null;

    return {
      id: String(entry._id),
      ticketNumber: entry.ticketNumber,
      serviceId: String(entry.serviceId),
      serviceName: entry.serviceName,
      title: entry.title,
      description: entry.description,
      status: entry.status,
      outcome: entry.status === "served" ? "Served" : "Canceled",
      joinedAt,
      finishedAt,
      date: (finishedAt || joinedAt).slice(0, 10),
    };
  });

  return {
    success: true,
    status: 200,
    history,
  };
}