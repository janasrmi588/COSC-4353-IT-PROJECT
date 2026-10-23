import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchServices } from "../data/servicesApi";
import { fetchMyQueues, joinQueue, leaveQueue } from "../data/queueAPI";
import { getStoredUser } from "../data/useNotifications";
import { useAutoRefresh } from "../data/useAutoRefresh";

function Home() {
  const user = getStoredUser();
  const email = user?.role === "user" ? user.email : null;

  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [description, setDescription] = useState("");

  const [serviceList, setServiceList] = useState([]);
  const [myEntries, setMyEntries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [leavingId, setLeavingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  const navigate = useNavigate();
  const loadedOnce = useRef(false);

  // Keep the user's positions and wait times fresh while the page is open.
  const refresh = useCallback(() => setReloadCount((n) => n + 1), []);
  useAutoRefresh(refresh, Boolean(email));

  useEffect(() => {
    if (!email) return;

    let ignore = false;

    async function load() {
      const [servicesResult, mineResult] = await Promise.all([
        fetchServices(),
        fetchMyQueues(email),
      ]);
      if (ignore) return;

      if (servicesResult.ok) setServiceList(servicesResult.services);
      if (mineResult.ok) setMyEntries(mineResult.entries);

      const failed = [servicesResult, mineResult].find((r) => !r.ok);
      if (!failed) {
        loadedOnce.current = true;
      } else if (!loadedOnce.current) {
        // A failed refresh later on keeps the last good data and stays quiet.
        setError(failed.message);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [email, reloadCount]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    navigate("/");
  };

  // Submitting the form puts the user in line for the chosen service.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!email) {
      setError("Please log in with a user account first.");
      return;
    }

    setSubmitting(true);
    const result = await joinQueue(email, Number(serviceId));
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setNotice(
      `You joined ${result.entry.serviceName}. Your ticket is ${result.entry.ticketNumber} (position #${result.entry.position}).`,
    );
    setTitle("");
    setServiceId("");
    setDescription("");
    setReloadCount((n) => n + 1);
  };

  const handleLeave = async (entry) => {
    setError("");
    setNotice("");
    setLeavingId(entry.id);

    const result = await leaveQueue(email, entry.id);
    if (result.ok) {
      setNotice(`You left the ${entry.serviceName} queue.`);
    } else {
      setError(result.message);
    }

    setLeavingId(null);
    setReloadCount((n) => n + 1);
  };

  return (
    <div className="home-page">
      <nav className="navbar">
        <h2>QueueSmart</h2>

        <div>
          <span>IT Help Desk</span>
          <button className="logout-button" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </nav>

      <main className="home-content">
        <div className="welcome">
          <h1>IT Help Desk</h1>
          <p>Submit a ticket and track your IT support requests.</p>
        </div>

        <div className="ticket-form-container">
          <h2>Create a Ticket</h2>

          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}

          <form onSubmit={handleSubmit}>
            <label>Issue Title</label>
            <input
              type="text"
              placeholder="Example: Cannot connect to Wi-Fi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <label>Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              required
            >
              <option value="">Select a service</option>
              {serviceList.map((service) => (
                <option
                  key={service.id}
                  value={service.id}
                  disabled={!service.isOpen}
                >
                  {service.name}
                  {service.isOpen ? "" : " (closed)"}
                </option>
              ))}
            </select>

            <label>Description</label>
            <textarea
              placeholder="Describe the issue you're experiencing..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Joining..." : "Submit Ticket"}
            </button>
          </form>
        </div>

        <div className="my-tickets">
          <h2>My Tickets</h2>
          {myEntries.length === 0 ? (
            <p>You currently have no open tickets.</p>
          ) : (
            <ul>
              {myEntries.map((entry) => (
                <li key={entry.id}>
                  {entry.ticketNumber} · {entry.serviceName} · Position #
                  {entry.position}
                  {entry.position === 1
                    ? " (you're next)"
                    : ` · ~${entry.estimatedWait} min wait`}{" "}
                  <button
                    type="button"
                    onClick={() => handleLeave(entry)}
                    disabled={leavingId === entry.id}
                  >
                    Leave queue
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default Home;
