import { useEffect } from "react";

export const REFRESH_MS = 5000;

export function useAutoRefresh(refresh, enabled = true, intervalMs = REFRESH_MS) {
    useEffect(() => {
        if (!enabled) return;

        function refreshIfVisible() {
            if (document.visibilityState === "visible") refresh();
        }

        const id = setInterval(refreshIfVisible, intervalMs);
        document.addEventListener("visibilitychange", refreshIfVisible);

        return () => {
            clearInterval(id);
            document.removeEventListener("visibilitychange", refreshIfVisible);
        };
    }, [refresh, enabled, intervalMs]);
}
