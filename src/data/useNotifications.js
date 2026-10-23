import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "./useAutoRefresh";

const API_URL = "http://localhost:3001/api/notifications";

// Login saves the signed-in user in sessionStorage (see Login.jsx).
export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("user"));
  } catch {
    return null;
  }
}

// Loads one user's notifications from the back end (newest first) and lets the
// page mark them as read.
//
//   const { notifications, loading, error, markAsRead } = useNotifications(email);
//
// Pass a falsy email (nobody logged in) and nothing is requested.
// The list refreshes by itself every few seconds (see useAutoRefresh).
export function useNotifications(email) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  const refresh = useCallback(() => setReloadCount((n) => n + 1), []);
  useAutoRefresh(refresh, Boolean(email));

  useEffect(() => {
    if (!email) return;

    let ignore = false;

    async function load() {
      try {
        const response = await fetch(
          `${API_URL}?email=${encodeURIComponent(email)}`,
        );
        const data = await response.json();
        if (ignore) return;

        if (!response.ok) {
          setError(data.message || "Could not load notifications.");
        } else {
          setNotifications(data.notifications);
          setError("");
        }
      } catch {
        if (!ignore) setError("Unable to connect to the server.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [email, reloadCount]);

  const markAsRead = useCallback(
    async (id) => {
      setError("");
      try {
        const response = await fetch(
          `${API_URL}/${id}/read?email=${encodeURIComponent(email)}`,
          { method: "PATCH" },
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Could not update the notification.");
          return;
        }

        setNotifications((current) =>
          current.map((n) => (n.id === id ? data.notification : n)),
        );
      } catch {
        setError("Unable to connect to the server.");
      }
    },
    [email],
  );

  return { notifications, loading, error, markAsRead };
}
