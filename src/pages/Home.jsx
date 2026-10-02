import { useState } from "react";


function Home() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Low");
  const [description, setDescription] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    alert("Ticket submitted!");

    setTitle("");
    setCategory("");
    setPriority("Low");
    setDescription("");
  };

  return (
    <div className="home-page">

      <nav className="navbar">
        <h2>QueueSmart</h2>

        <div>
          <span>IT Help Desk</span>
          <button className="logout-button">Log Out</button>
        </div>
      </nav>

      <main className="home-content">

        <div className="welcome">
          <h1>IT Help Desk</h1>
          <p>Submit a ticket and track your IT support requests.</p>
        </div>

        <div className="ticket-form-container">

          <h2>Create a Ticket</h2>

          <form onSubmit={handleSubmit}>

            <label>Issue Title</label>
            <input
              type="text"
              placeholder="Example: Cannot connect to Wi-Fi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <label>Issue Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Select a category</option>
              <option value="Wi-Fi">Wi-Fi</option>
              <option value="Account">Account / Login</option>
              <option value="Email">Email</option>
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Other">Other</option>
            </select>

            <label>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>

            <label>Description</label>
            <textarea
              placeholder="Describe the issue you're experiencing..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />

            <button type="submit">Submit Ticket</button>

          </form>

        </div>

        <div className="my-tickets">
          <h2>My Tickets</h2>
          <p>You currently have no open tickets.</p>
        </div>

      </main>

    </div>
  );
}

export default Home;