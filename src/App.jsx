import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import History from "./pages/History";
import QueueStatus from "./pages/QueueStatus";
import QueueManagement from "./pages/admin/QueueManagement";
import ServiceManagement from "./pages/admin/ServiceManagement";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import { getStoredUser } from "./data/useNotifications";
import "./App.css";


function RequireAdmin({ children }) {
  const user = getStoredUser();
  if (user?.role !== "administrator") {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/queue-status" element={<QueueStatus />} />
        <Route
          path="/admin/queue"
          element={
            <RequireAdmin>
              <QueueManagement />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/services"
          element={
            <RequireAdmin>
              <ServiceManagement />
            </RequireAdmin>
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
