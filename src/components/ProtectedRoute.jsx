import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, allowedRole }) {
  const user = JSON.parse(sessionStorage.getItem("user"));

  // Not logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Logged in, but wrong role
  if (allowedRole && user.role !== allowedRole) {
    if (user.role === "administrator") {
      return <Navigate to="/admin/services" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;