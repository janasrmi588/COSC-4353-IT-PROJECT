// History module, logic: track queue participation history for users (in memory or mocked is fine).
import { queueEntries, services, users } from "../../data/store.js";
export const FINISHED_STATUSES = ["served", "canceled"];

const OUTCOME_LABELS = { served: "Served", canceled: "Canceled" };

function fail(status, message) {
    return { success: false, status, message };
}

function normalizeEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Turn one finished queue entry into a history row for the front end.
function describeHistoryEntry(entry) {
    const service = services.find((s) => s.id === entry.serviceId);
    const finishedAt = entry.finishedAt ?? entry.joinedAt;

    return {
        id: entry.id,
        ticketNumber: entry.ticketNumber,
        serviceId: entry.serviceId,
        serviceName: service ? service.name : "Unknown service",
        status: entry.status,
        outcome: OUTCOME_LABELS[entry.status] ?? entry.status,
        joinedAt: entry.joinedAt,
        finishedAt: entry.finishedAt,
        date: finishedAt.slice(0, 10),
    };
}

export function listHistory(userEmail) {
    const email = normalizeEmail(userEmail);
    if (!email) {
        return fail(401, "Please log in first.");
    }

    const user = users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
        return fail(401, "Please log in first.");
    }

    const history = queueEntries
        .filter(
        (e) =>
            e.userEmail.toLowerCase() === email &&
            FINISHED_STATUSES.includes(e.status),
        )
    .sort(
        (a, b) =>
            new Date(b.finishedAt ?? b.joinedAt) -
                new Date(a.finishedAt ?? a.joinedAt) || b.id - a.id,
    )
    .map(describeHistoryEntry);

    return { success: true, status: 200, history };
}
