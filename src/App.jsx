import {
  BrowserRouter,
  Outlet,
  Routes,
  Route,
} from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import History from "./pages/History";
import QueueStatus from "./pages/QueueStatus";
import QueueManagement from "./pages/admin/QueueManagement";
import ServiceManagement from "./pages/admin/ServiceManagement";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

// Every page except login and register shows the navbar on top.
function WithNavbar() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ROUTES WITH NAVBAR */}
        <Route element={<WithNavbar />}>
          {/* USER ROUTES */}
          <Route
            path="/home"
            element={
              <ProtectedRoute allowedRole="user">
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRole="user">
                <History />
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

          {/* ADMIN ROUTES */}
          <Route
            path="/admin/queue"
            element={
              <ProtectedRoute allowedRole="administrator">
                <QueueManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRole="administrator">
                <AdminDashboard />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;