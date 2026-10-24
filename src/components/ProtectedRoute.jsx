import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, allowedRole }) {
  const user = JSON.parse(sessionStorage.getItem("user"));

  // Nobody is logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Someone is logged in, but they have the wrong role
  if (user.role !== allowedRole) {
    if (user.role === "administrator") {
      return <Navigate to="/admin/services" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  // Correct role, so show the page
  return children;
}

export default ProtectedRoute;