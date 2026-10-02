import styles from "./History.module.css";
import { getHistory } from "../data/queueHelpers";
import { queueEntries, services, mockCurrentUser } from "../data/queueMockData";

function formatDate(isoDate) {
  return new Date(isoDate + "T00:00:00").toLocaleDateString([], {
    dateStyle: "medium",
  });
}

function History({
  entries = queueEntries,
  serviceList = services,
  currentUser = mockCurrentUser,
}) {
  const rows = getHistory(entries, serviceList, currentUser.email);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>History</h1>
        <p className={styles.subtitle}>Your past queue visits, newest first.</p>
      </header>

      {rows.length === 0 ? (
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
