import { useState } from "react";
import {
  services,
  queueEntries,
  statusUpdates,
  mockCurrentUser,
} from "../data/queueMockData";
import { getActiveEntries, getWaitingQueue } from "../data/queueHelpers";
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

function QueuePanel({ item, entries }) {
  const waiting = getWaitingQueue(entries, item.service.id);

  return (
    <ol className={styles.queueList}>
      {waiting.map((e, i) => {
        const isYou = e.id === item.entry.id;

        let className = "";
        let youLabel = null;
        if (isYou) {
          className = styles.you;
          youLabel = <strong>(You)</strong>;
        }

        return (
          <li key={e.id} className={className}>
            {i + 1}. {e.ticketNumber} {youLabel}
          </li>
        );
      })}
    </ol>
  );
}

function UpdatesPanel({ item, updates }) {
  const mine = updates.filter((u) => u.entryId === item.entry.id);

  mine.sort((a, b) => {
    const timeA = new Date(a.timestamp);
    const timeB = new Date(b.timestamp);
    return timeB - timeA;
  });
  if (mine.length === 0) return <p>No updates yet.</p>;
  return (
    <ul className={styles.updates}>
      {mine.map((u) => (
        <li key={u.id}>
          <span>{STATUS_LABEL[u.status]}</span> {u.message}
          <time dateTime={u.timestamp}> {formatTime(u.timestamp)}</time>
        </li>
      ))}
    </ul>
  );
}

function QueueStatus({
  entries = queueEntries,
  serviceList = services,
  updates = statusUpdates,
  currentUser = mockCurrentUser,
}) {
  const active = getActiveEntries(entries, serviceList, currentUser.email);
  let firstId = null;
  if (active.length > 0) {
    firstId = active[0].entry.id;
  }
  const [selectedId, setSelectedId] = useState(firstId);
  const [tab, setTab] = useState("queue");

  let selected = active.find((a) => a.entry.id === selectedId);
  if (selected === undefined) {
    selected = active[0];
  }

  if (!selected) {
    return (
      <main className={styles.layout}>
        <section className={styles.empty}>
          <h1>Queue Status</h1>
          <p>You're not in a queue yet.</p>
        </section>
      </main>
    );
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
                  <span className={styles.itemPosition}>#{a.position}</span>
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
          {tab === "queue" && <QueuePanel item={selected} entries={entries} />}
          {tab === "updates" && (
            <UpdatesPanel item={selected} updates={updates} />
          )}
        </div>
      </section>
    </main>
  );
}

export default QueueStatus;
