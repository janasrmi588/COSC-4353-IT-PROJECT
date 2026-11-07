import { authFetch } from "./authFetch";

const API_URL = "http://localhost:3001/api/history";

export async function fetchHistory() {
  try {
    const response = await authFetch(API_URL);
    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        message: data.message || "Could not load history.",
      };
    }

    return {
      ok: true,
      history: data.history,
    };
  } catch {
    return {
      ok: false,
      message: "Unable to connect to the server.",
    };
  }
}