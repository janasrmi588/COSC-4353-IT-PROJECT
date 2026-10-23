import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchServices, updateService } from "../../data/servicesApi";
import { fetchQueue } from "../../data/queueAPI";
import { getStoredUser } from "../../data/useNotifications";
import { useAutoRefresh } from "../../data/useAutoRefresh";
import "./AdminDashboard.css";
import "./QueueManagement.css";

export default function AdminDashboard() {
  const adminEmail = getStoredUser()?.email;

  const [services, setServices] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  // Keep queue lengths current while an admin has the page open.
  const refresh = useCallback(() => setReloadCount((n) => n + 1), []);
  useAutoRefresh(refresh, Boolean(adminEmail));

  useEffect(() => {
    let ignore = false;

    async function load() {
      const [servicesResult, queueResult] = await Promise.all([
        fetchServices(),
        fetchQueue(adminEmail),
      ]);
      if (ignore) return;

      if (servicesResult.ok) setServices(servicesResult.services);
      if (queueResult.ok) setWaiting(queueResult.queue);

      const failed = [servicesResult, queueResult].find((r) => !r.ok);
      setError(failed ? failed.message : "");
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
  }, [adminEmail, reloadCount]);

  function getQueueLength(serviceId) {
    return waiting.filter((entry) => entry.serviceId === serviceId).length;
  }

  async function toggleQueue(service) {
    setSavingId(service.id);
    setError("");

    const result = await updateService(adminEmail, service.id, {
      name: service.name,
      description: service.description,
      expectedDuration: service.expectedDuration,
      priority: service.priority,
      isOpen: !service.isOpen,
    });

    if (result.ok) {
      setServices((current) =>
        current.map((s) => (s.id === service.id ? result.service : s)),
      );
    } else {
      setError(result.message);
    }

    setSavingId(null);
    setReloadCount((n) => n + 1);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>See every service queue and open or close them.</p>
        <p>
          <Link to="/admin/queue">Manage queues</Link>
        </p>
      </header>

      <section className="admin-card">
        <h2>Services</h2>

        {error && (
          <p role="alert" className="qm-message qm-error">
            {error}
          </p>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Queue length</th>
                <th>Status</th>
                <th>Quick action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>Loading services...</td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id}>
                    <td>{service.name}</td>
                    <td>{getQueueLength(service.id)}</td>
                    <td>
                      <span
                        className={
                          service.isOpen
                            ? "admin-badge open"
                            : "admin-badge closed"
                        }
                      >
                        {service.isOpen ? "Open" : "Closed"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn primary"
                        onClick={() => toggleQueue(service)}
                        disabled={savingId === service.id}
                      >
                        {service.isOpen ? "Close queue" : "Open queue"}
                      </button>
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
