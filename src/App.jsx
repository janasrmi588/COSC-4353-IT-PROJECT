import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import History from "./pages/History";
import QueueStatus from "./pages/QueueStatus";
import ServiceManagement from "./pages/admin/ServiceManagement";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import QueueManagement from "./pages/admin/QueueManagement";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path= "/register" element={<Register />} />

        <Route
          path="/history"
          element={
            <ProtectedRoute allowedRole="user">
              <History />
            </ProtectedRoute>
          }
        />

        <Route
          path="/home"
          element={
            <ProtectedRoute allowedRole="user">
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/QueueManagement"
          element={
            <ProtectedRoute allowedRole="administrator">
              <QueueManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/queue-status"
          element={
            <ProtectedRoute allowedRole="user">
              <QueueStatus />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="user">
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/services"
          element={
            <ProtectedRoute allowedRole="administrator">
              <ServiceManagement />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
