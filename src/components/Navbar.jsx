import { Link, NavLink, useNavigate } from "react-router-dom";
import { getStoredUser } from "../data/useNotifications";
import styles from "./Navbar.module.css";

// Links shown for each role. `end` makes the link highlight only on an exact
// match, so "/admin/queue" does not light up "/admin".
const USER_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/home", label: "Join Queue" },
  { to: "/queue-status", label: "Queue Status" },
  { to: "/history", label: "History" },
];

const ADMIN_LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/queue", label: "Queue Management" },
  { to: "/admin/services", label: "Services" },
];

function Navbar() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const isAdmin = user?.role === "administrator";
  const links = isAdmin ? ADMIN_LINKS : user ? USER_LINKS : [];
  const brandTarget = isAdmin ? "/admin/dashboard" : user ? "/dashboard" : "/";

  // Login saves the user in sessionStorage (see Login.jsx); logging out just
  // removes it and returns to the login page.
  function handleLogout() {
    sessionStorage.removeItem("user");
    navigate("/");
  }

  return (
    <header className={styles.bar}>
      <nav className={styles.nav} aria-label="Main">
        <Link to={brandTarget} className={styles.brand}>
          QueueSmart
        </Link>

        <ul className={styles.links}>
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className={styles.account}>
          {user ? (
            <>
              <span className={styles.who}>
                {user.email}
                <small className={styles.role}>
                  {isAdmin ? "Administrator" : "User"}
                </small>
              </span>
              <button
                type="button"
                className={styles.logout}
                onClick={handleLogout}
              >
                Log Out
              </button>
            </>
          ) : (
            <Link to="/" className={styles.logout}>
              Log In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
