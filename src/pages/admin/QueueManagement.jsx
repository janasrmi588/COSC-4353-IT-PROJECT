import { useState } from "react";
import { services, queueEntries } from "../../data/queueMockData";
import { getWaitingQueue } from "../../data/queueHelpers";
import "./AdminDashboard.css"; 
import "./QueueManagement.css";


function buildQueues() {
  const waiting = getWaitingQueue(queueEntries, services);
  const queues = {};

  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    queues[service.id] = waiting.filter((entry) => entry.serviceId === service.id);
  }

  return queues;
}

export default function QueueManagement() {

  const [selectedId, setSelectedId] = useState(services[0].id);


  const [queues, setQueues] = useState(buildQueues());


  const queue = queues[selectedId];

  function saveQueue(newQueue) {
    setQueues({ ...queues, [selectedId]: newQueue });
  }


  function moveUp(index) {
    if (index === 0) {
      return; 
    }
    const newQueue = [...queue];
    const temp = newQueue[index - 1];
    newQueue[index - 1] = newQueue[index];
    newQueue[index] = temp;
    saveQueue(newQueue);
  }


  function moveDown(index) {
    if (index === queue.length - 1) {
      return;
    }
    const newQueue = [...queue];
    const temp = newQueue[index + 1];
    newQueue[index + 1] = newQueue[index];
    newQueue[index] = temp;
    saveQueue(newQueue);
  }


  function removeUser(index) {
    const newQueue = queue.filter((entry, i) => i !== index);
    saveQueue(newQueue);
  }

  function serveNext() {
    if (queue.length === 0) {
      return;
    }
    saveQueue(queue.slice(1));
  }

  function handleServiceChange(event) {
    setSelectedId(Number(event.target.value));
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <h1>Queue Management</h1>
        <p>View a service queue, reorder or remove users, and serve the next user.</p>
      </header>

      <section className="admin-card">
        <div className="qm-toolbar">
          <div className="qm-field">
            <label htmlFor="service-select">Service</label>
            <select id="service-select" value={selectedId} onChange={handleServiceChange}>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="admin-btn primary" onClick={serveNext}>
            Serve next
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Ticket</th>
                <th>User</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{index + 1}</td>
                  <td>{entry.ticketNumber}</td>
                  <td>{entry.userEmail}</td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="admin-btn" onClick={() => moveUp(index)}>
                        Move up
                      </button>
                      <button type="button" className="admin-btn" onClick={() => moveDown(index)}>
                        Move down
                      </button>
                      <button type="button" className="admin-btn" onClick={() => removeUser(index)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
