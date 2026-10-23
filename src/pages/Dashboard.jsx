import { Link } from "react-router-dom";
import { services, queueEntries, mockCurrentUser } from "../data/queueMockData";
import { getActiveEntries } from "../data/queueHelpers";
import { getStoredUser, useNotifications } from "../data/useNotifications";
import styles from "./Dashboard.module.css";

const STATUS_LABEL = {
  waiting: "Waiting",
  "almost ready": "Almost ready",
};

const STATUS_CLASS = {
  waiting: "waiting",
  "almost ready": "almostReady",
};

const PRIORITY_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const TYPE_LABEL = {
  status: "Status change",
  queue: "Queue update",
};

const RECENT_NOTIFICATION_COUNT = 5;

function formatTime(iso) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Dashboard({
  entries = queueEntries,
  serviceList = services,
  currentUser = mockCurrentUser,
}) {
  const active = getActiveEntries(entries, serviceList, currentUser.email);

  const openServices = serviceList.filter((s) => s.isOpen);
  const waitingFor = (serviceId) =>
    entries.filter((e) => e.status === "waiting" && e.serviceId === serviceId)
      .length;

  const loggedInEmail = getStoredUser()?.email;
  const {
    notifications: myNotifications,
    loading: notificationsLoading,
    error: notificationsError,
    markAsRead,
  } = useNotifications(loggedInEmail);

  const isRead = (n) => n.read;
  const unreadNotifications = myNotifications.filter((n) => !isRead(n));
  const recentNotifications = myNotifications.slice(
    0,
    RECENT_NOTIFICATION_COUNT,
  );

  let emptyNotificationsMessage = "You have no notifications.";
  if (!loggedInEmail) {
    emptyNotificationsMessage = "Log in to see your notifications.";
  } else if (notificationsLoading) {
    emptyNotificationsMessage = "Loading notifications...";
  } else if (notificationsError) {
    emptyNotificationsMessage = notificationsError;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          Your queues, the services that are open, and your latest
          notifications.
        </p>
      </header>

      {unreadNotifications.length > 0 && (
        <section
          className={styles.alertBar}
          aria-label="New notifications"
          aria-live="polite"
        >
          <ul className={styles.alertList}>
            {unreadNotifications.map((n) => (
              <li key={n.id} className={styles.alertItem}>
                <span className={styles.typeTag}>
                  {TYPE_LABEL[n.type] || "Notification"}
                </span>
                <span className={styles.alertMessage}>{n.message}</span>
                <time className={styles.alertTime} dateTime={n.createdAt}>
                  {formatTime(n.createdAt)}
                </time>
                <button
                  type="button"
                  className={styles.alertButton}
                  onClick={() => markAsRead(n.id)}
                  aria-label={"Mark as read: " + n.message}
                >
                  Mark as read
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.panel} aria-labelledby="queue-status-title">
        <div className={styles.panelHeader}>
          <h2 id="queue-status-title" className={styles.panelTitle}>
            Current queue status
          </h2>
          {active.length > 0 && (
            <Link to="/queue-status" className={styles.link}>
              View full status
            </Link>
          )}
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Your active tickets</span>
            <span className={styles.statValue}>{active.length}</span>
          </div>
        </div>

        {active.length === 0 ? (
          <p className={styles.empty}>You're not in a queue right now.</p>
        ) : (
          <ul className={styles.list}>
            {active.map((item) => {
              const waitText =
                item.position === 1
                  ? "You're next"
                  : "~" + item.estimatedWait + " min";
              return (
                <li key={item.entry.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{item.service.name}</div>
                    <div className={styles.rowMeta}>
                      {item.entry.ticketNumber}
                    </div>
                  </div>
                  <dl className={styles.figures}>
                    <div>
                      <dt>Position</dt>
                      <dd>#{item.position}</dd>
                    </div>
                    <div>
                      <dt>Ahead of you</dt>
                      <dd>{item.peopleAhead}</dd>
                    </div>
                    <div>
                      <dt>Est. wait</dt>
                      <dd>{waitText}</dd>
                    </div>
                  </dl>
                  <span
                    className={`${styles.badge} ${styles[STATUS_CLASS[item.displayStatus]]}`}
                  >
                    {STATUS_LABEL[item.displayStatus]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="services-title">
          <div className={styles.panelHeader}>
            <h2 id="services-title" className={styles.panelTitle}>
              Active services
            </h2>
            <span className={styles.count}>
              {openServices.length} open ·{" "}
              <Link to="/queues" className={styles.link}>
                Join a queue
              </Link>
            </span>
          </div>

          {openServices.length === 0 ? (
            <p className={styles.empty}>No services are open right now.</p>
          ) : (
            <ul className={styles.list}>
              {openServices.map((service) => (
                <li key={service.id} className={styles.serviceRow}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{service.name}</div>
                    <div className={styles.rowDescription}>
                      {service.description}
                    </div>
                    <div className={styles.rowMeta}>
                      {service.expectedDuration} min per person ·{" "}
                      {waitingFor(service.id)} waiting
                    </div>
                  </div>
                  <span
                    className={`${styles.badge} ${styles["priority_" + service.priority]}`}
                  >
                    {PRIORITY_LABEL[service.priority]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="notifications-title">
          <div className={styles.panelHeader}>
            <h2 id="notifications-title" className={styles.panelTitle}>
              Notifications
            </h2>
            <span className={styles.count}>
              {unreadNotifications.length} unread
            </span>
          </div>

          {notificationsError && recentNotifications.length > 0 && (
            <p className={styles.empty} role="alert">
              {notificationsError}
            </p>
          )}

          {recentNotifications.length === 0 ? (
            <p className={styles.empty}>{emptyNotificationsMessage}</p>
          ) : (
            <ul className={styles.list}>
              {recentNotifications.map((n) => (
                <li key={n.id} className={styles.notification}>
                  <div className={styles.rowMain}>
                    <div
                      className={
                        isRead(n) ? styles.notifRead : styles.notifUnread
                      }
                    >
                      {n.message}
                    </div>
                    <div className={styles.rowMeta}>
                      {TYPE_LABEL[n.type] || "Notification"} ·{" "}
                      <time dateTime={n.createdAt}>
                        {formatTime(n.createdAt)}
                      </time>
                    </div>
                  </div>
                  {!isRead(n) && <span className={styles.newTag}>New</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default Dashboard;
