import { useState } from "react";
import { getStoredUser, useNotifications } from "../data/useNotifications";
import { useMyQueues } from "../data/useMyQueues";
import styles from "./QueueStatus.module.css";

const STEPS = ["waiting", "almost ready", "served"];
const STATUS_LABEL = {
  waiting: "Waiting",
  "almost ready": "Almost ready",
  served: "Served",
  canceled: "Canceled",
};

const STATUS_CLASS = {
  waiting: "waiting",
  "almost ready": "almostReady",
  served: "served",
  canceled: "canceled",
};

const TYPE_LABEL = {
  status: "Status change",
  queue: "Queue update",
};

function formatTime(iso) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusStepper({ status }) {
  const current = STEPS.indexOf(status);

  return (
    <ol className={styles.stepper}>
      {STEPS.map((step, i) => {
        let className = styles.step;
        if (i <= current) {
          className = className + " " + styles.stepDone;
        }

        let ariaCurrent = undefined;
        if (i === current) {
          ariaCurrent = "step";
        }

        return (
          <li key={step} className={className} aria-current={ariaCurrent}>
            {STATUS_LABEL[step]}
          </li>
        );
      })}
    </ol>
  );
}

function PositionCards({ item }) {
  const { position, peopleAhead, estimatedWait } = item;

  let waitText = "~" + estimatedWait + " min";
  if (position === 1) {
    waitText = "You're next";
  }

  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Your position</span>
        <span className={styles.bigNumber}>#{position}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>People ahead</span>
        <span className={styles.bigNumber}>{peopleAhead}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Estimated wait</span>
        <span className={styles.bigNumber}>{waitText}</span>
      </div>
    </div>
  );
}

function DetailsPanel({ item }) {
  const { entry, service } = item;
  return (
    <dl className={styles.details}>
      <dt>Service</dt>
      <dd>{service.name}</dd>
      <dt>Description</dt>
      <dd>{service.description}</dd>
      <dt>Ticket</dt>
      <dd>{entry.ticketNumber}</dd>
      <dt>Joined</dt>
      <dd>{formatTime(entry.joinedAt)}</dd>
      <dt>Expected duration</dt>
      <dd>{service.expectedDuration} min per person</dd>
      <dt>Priority</dt>
      <dd>{service.priority}</dd>
    </dl>
  );
}

// The server does not share other people's tickets, so the line is shown as
// anonymous spots ahead of the user.
function QueuePanel({ item }) {
  const ahead = Array.from({ length: item.peopleAhead }, (_, i) => i + 1);
  return (
    <ol className={styles.queueList}>
      {ahead.map((n) => (
        <li key={n}>{n}. Another person</li>
      ))}
      <li className={styles.you}>
        {item.position}. {item.entry.ticketNumber} <strong>(You)</strong>
      </li>
    </ol>
  );
}

function UpdatesPanel({ item, notifications }) {
  const mine = notifications
    .filter((n) => n.entryId === item.entry.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (mine.length === 0) return <p>No updates yet.</p>;
  return (
    <ul className={styles.updates}>
      {mine.map((n) => (
        <li key={n.id}>
          <span>{TYPE_LABEL[n.type] || "Update"}</span> {n.message}
          <time dateTime={n.createdAt}> {formatTime(n.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}

function Message({ children }) {
  return (
    <main className={styles.layout}>
      <section className={styles.empty}>
        <h1>Queue Status</h1>
        <p>{children}</p>
      </section>
    </main>
  );
}

function QueueStatus() {
  const email = getStoredUser()?.email;
  const { active, loading, error } = useMyQueues(email);
  const { notifications } = useNotifications(email);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("queue");

  if (!email) return <Message>Log in to see your queues.</Message>;
  if (loading) return <Message>Loading your queues...</Message>;
  if (error) return <Message>{error}</Message>;

  let selected = active.find((a) => a.entry.id === selectedId);
  if (selected === undefined) {
    selected = active[0];
  }

  if (!selected) {
    return <Message>You're not in a queue yet.</Message>;
  }

  return (
    <main className={styles.layout}>
      <aside className={styles.list} aria-label="My queues">
        <h2>My Queues</h2>
        <ul>
          {active.map((a) => {
            let buttonClass = "";
            if (a.entry.id === selected.entry.id) {
              buttonClass = styles.selected;
            }

            return (
              <li key={a.entry.id}>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setSelectedId(a.entry.id)}
                >
                  <span className={styles.itemTitle}>{a.service.name}</span>
                  <span className={styles.itemTicket}>
                    {a.entry.ticketNumber}
                  </span>
                  <span className={styles.itemPosition}>
                    #{a.position}
                    <small className={styles.itemPositionLabel}>in queue</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={styles.detail}>
        <header className={styles.header}>
          <div>
            <h1>{selected.service.name}</h1>
            <p className={styles.ticket}>
              {selected.entry.ticketNumber} · Priority:{" "}
              {selected.service.priority}
            </p>
          </div>
          <span
            className={`${styles.badge} ${styles[STATUS_CLASS[selected.displayStatus]]}`}
          >
            {STATUS_LABEL[selected.displayStatus]}
          </span>
        </header>
        {!selected.service.isOpen && (
          <p role="alert" className={styles.notice}>
            This service is currently closed.
          </p>
        )}

        <StatusStepper status={selected.displayStatus} />
        <PositionCards item={selected} />

        <div role="tablist" className={styles.tabs}>
          {["details", "queue", "updates"].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div role="tabpanel" className={styles.panel}>
          {tab === "details" && <DetailsPanel item={selected} />}
          {tab === "queue" && <QueuePanel item={selected} />}
          {tab === "updates" && (
            <UpdatesPanel item={selected} notifications={notifications} />
          )}
        </div>
      </section>
    </main>
  );
}

export default QueueStatus;
