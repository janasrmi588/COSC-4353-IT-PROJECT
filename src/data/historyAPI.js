const API_URL = "http://localhost:3001/api/history";

export async function fetchHistory(userEmail) {
    try {
        const response = await fetch(
        `${API_URL}?email=${encodeURIComponent(userEmail ?? "")}`,
        );
        const data = await response.json();

        if (!response.ok) {
            return { ok: false, message: data.message || "Something went wrong." };
        }
        return { ok: true, history: data.history };
    } catch {
        return { ok: false, message: "Unable to connect to the server." };
    }
}
