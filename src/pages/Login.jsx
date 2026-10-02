import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    if (email && password) {
      navigate("/home");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        <h1>QueueSmart</h1>
        <p className="subtitle">University IT Help Desk</p>

        <form onSubmit={handleLogin}>

          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your university email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Log In</button>

        </form>

        <p className="register">
          Don't have an account? <span>Register</span>
        </p>

      </div>
    </div>
  );
}

export default Login;