import { useCallback, useEffect, useState } from "react";
import { fetchServices } from "../../data/servicesApi";
import { fetchQueue, serveNextUser } from "../../data/queueAPI";
import { getStoredUser } from "../../data/useNotifications";
import "./AdminDashboard.css";
import "./QueueManagement.css";

const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };

function formatTime(iso) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function QueueManagement() {
  const adminEmail = getStoredUser()?.email;

  const [serviceList, setServiceList] = useState([]);
  // "" means every service (one combined queue).
  const [selectedId, setSelectedId] = useState("");
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serving, setServing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  // The list of services for the dropdown.
  useEffect(() => {
    let ignore = false;

    async function loadServices() {
      const result = await fetchServices();
      if (ignore) return;
      if (result.ok) {
        setServiceList(result.services);
      } else {
        setError(result.message);
      }
    }

    loadServices();
    return () => {
      ignore = true;
    };
  }, []);

  // The current queue; reloads when the service changes or after an action.
  useEffect(() => {
    if (!adminEmail) return;

    let ignore = false;

    async function loadQueue() {
      const result = await fetchQueue(adminEmail, selectedId);
      if (ignore) return;

      if (result.ok) {
        setQueue(result.queue);
        setError("");
      } else {
        setError(result.message);
      }
      setLoading(false);
    }

    loadQueue();
    return () => {
      ignore = true;
    };
  }, [adminEmail, selectedId, reloadCount]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  async function handleServeNext() {
    setServing(true);
    setNotice("");
    setError("");

    const result = await serveNextUser(adminEmail, selectedId);

    if (result.ok) {
      setNotice(
        `Served ${result.entry.userEmail} (${result.entry.ticketNumber}, ${result.entry.serviceName}).`,
      );
    } else {
      setError(result.message);
    }

    setServing(false);
    reload();
  }

  function handleServiceChange(event) {
    setSelectedId(event.target.value);
    setNotice("");
    setLoading(true);
  }

  if (!adminEmail) {
    return (
      <main className="admin-page">
        <header className="admin-header">
          <h1>Queue Management</h1>
          <p>Please log in as an administrator to manage queues.</p>
        </header>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <h1>Queue Management</h1>
        <p>
          View the current queue and serve the next user. Users are ordered by
          priority, then by arrival time.
        </p>
      </header>

      <section className="admin-card">
        <div className="qm-toolbar">
          <div className="qm-field">
            <label htmlFor="service-select">Service</label>
            <select
              id="service-select"
              value={selectedId}
              onChange={handleServiceChange}
            >
              <option value="">All services</option>
              {serviceList.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="admin-btn" onClick={reload}>
            Refresh
          </button>

          <button
            type="button"
            className="admin-btn primary"
            onClick={handleServeNext}
            disabled={serving || queue.length === 0}
          >
            {serving ? "Serving..." : "Serve next"}
          </button>
        </div>

        {error && (
          <p role="alert" className="qm-message qm-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="qm-message qm-success">
            {notice}
          </p>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Ticket</th>
                <th>User</th>
                <th>Service</th>
                <th>Priority</th>
                <th>Joined</th>
                <th>Est. wait</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Loading queue...</td>
                </tr>
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nobody is waiting.</td>
                </tr>
              ) : (
                queue.map((entry, index) => (
                  <tr key={entry.id}>
                    <td>{selectedId ? entry.position : index + 1}</td>
                    <td>{entry.ticketNumber}</td>
                    <td>{entry.userEmail}</td>
                    <td>{entry.serviceName}</td>
                    <td>{PRIORITY_LABELS[entry.priority] ?? entry.priority}</td>
                    <td>{formatTime(entry.joinedAt)}</td>
                    <td>
                      {entry.estimatedWait === 0
                        ? "Next"
                        : `~${entry.estimatedWait} min`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
