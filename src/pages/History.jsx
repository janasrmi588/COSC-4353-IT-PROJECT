import { useEffect, useState } from "react";
import styles from "./History.module.css";
import { fetchHistory } from "../data/historyAPI";
import { getStoredUser } from "../data/useNotifications";

function formatDate(isoDate) {
  return new Date(isoDate + "T00:00:00").toLocaleDateString([], {
    dateStyle: "medium",
  });
}

function History() {
  const email = getStoredUser()?.email;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      const result = await fetchHistory(email);
      if (ignore) return;

      if (result.ok) {
        setRows(result.history);
        setError("");
      } else {
        setError(result.message);
      }
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
  }, [email]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>History</h1>
        <p className={styles.subtitle}>Your past queue visits, newest first.</p>
      </header>

      {loading ? (
        <p className={styles.empty}>Loading your history...</p>
      ) : error ? (
        <p className={styles.empty}>{error}</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          No history yet. Once a ticket is served or canceled, it will show up
          here.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Service</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.date)}</td>
                <td>{row.serviceName}</td>
                <td>
                  <span
                    className={
                      row.outcome === "Served" ? styles.served : styles.canceled
                    }
                  >
                    {row.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default History;
