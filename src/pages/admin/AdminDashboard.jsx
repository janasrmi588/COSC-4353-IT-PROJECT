import { useState } from "react";
import { services as initialServices, queueEntries } from "../../data/queueMockData";
import { getWaitingQueue } from "../../data/queueHelpers";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  
  const [services, setServices] = useState(initialServices);

  
  const waiting = getWaitingQueue(queueEntries, services);


  function getQueueLength(serviceId) {
    let count = 0;
    for (let i = 0; i < waiting.length; i++) {
      if (waiting[i].serviceId === serviceId) {
        count = count + 1;
      }
    }
    return count;
  }


  function toggleQueue(serviceId) {
    const newServices = services.map((service) => {
      if (service.id === serviceId) {
        return { ...service, isOpen: !service.isOpen };
      }
      return service;
    });
    setServices(newServices);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>See every service queue and open or close them.</p>
      </header>

      <section className="admin-card">
        <h2>Services</h2>

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
              {services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>{getQueueLength(service.id)}</td>
                  <td>
                    <span className={service.isOpen ? "admin-badge open" : "admin-badge closed"}>
                      {service.isOpen ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn primary"
                      onClick={() => toggleQueue(service.id)}
                    >
                      {service.isOpen ? "Close queue" : "Open queue"}
                    </button>
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
