import { useEffect, useState } from "react";
import { fetchMyQueues } from "./queueAPI";
import { fetchServices } from "./servicesApi";
import { getDisplayStatus } from "./queueHelpers";

// Loads the signed-in user's active queue entries plus the service list.
//
//   const { active, services, loading, error } = useMyQueues(email);
//
// Each item in `active` looks like:
//   { entry, service, position, peopleAhead, estimatedWait, displayStatus }
// where displayStatus is "waiting" or "almost ready".
// Pass a falsy email (nobody logged in) and nothing is requested.
function buildActive(entries, services) {
    return entries.map((entry) => {
        // If the service was deleted, still show the ticket with what we know.
        const service = services.find((s) => s.id === entry.serviceId) ?? {
            id: entry.serviceId,
            name: entry.serviceName,
            description: "",
            expectedDuration: 0,
            priority: entry.priority,
            isOpen: true,
        };

        return {
            entry,
            service,
            position: entry.position,
            peopleAhead: entry.peopleAhead,
            estimatedWait: entry.estimatedWait,
            displayStatus: getDisplayStatus(entry, entry.position),
        };
    });
}

export function useMyQueues(email) {
    const [services, setServices] = useState([]);
    const [active, setActive] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!email) return;

        let ignore = false;

        async function load() {
            const [servicesResult, mineResult] = await Promise.all([
                fetchServices(),
                fetchMyQueues(email),
            ]);
            if (ignore) return;

            const failed = [servicesResult, mineResult].find((r) => !r.ok);
            if (failed) {
                setError(failed.message);
            } else {
                setServices(servicesResult.services);
                setActive(buildActive(mineResult.entries, servicesResult.services));
                setError("");
            }
            setLoading(false);
        }

        load();
        return () => {
            ignore = true;
        };
    }, [email]);

    return { active, services, loading: Boolean(email) && loading, error };
}
