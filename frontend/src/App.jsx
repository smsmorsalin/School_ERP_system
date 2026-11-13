import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Subjects from "./pages/Subjects";
import Timetable from "./pages/Timetable";
import Attendance from "./pages/Attendance";
import Exams from "./pages/Exams";
import Results from "./pages/Results";
import Fees from "./pages/Fees";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Checkout from "./pages/Checkout";
import Announcements from "./pages/Announcements";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

function Splash({ label = "Preparing your workspace…" }) {
  return (
    <div className="app-splash">
      <div className="brand-mark">
        <GraduationCap size={24} />
      </div>
      <strong>School ERP</strong>
      <span>
        <Spinner size={15} /> {label}
      </span>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const allowed = roles.some((role) => user?.roles?.includes(role));
  if (!allowed) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: "48px auto" }}>
        <div className="card-body" style={{ padding: 28, textAlign: "center" }}>
          <h3 style={{ fontSize: 18 }}>You do not have access to this area</h3>
          <p style={{ color: "var(--text-2)", fontSize: 13, margin: "8px 0 18px" }}>
            This section is limited to {roles.join(", ")} accounts. If you believe this is a
            mistake, contact your school administrator.
          </p>
          <Link to="/" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { user, booting } = useAuth();

  if (booting) return <Splash label="Checking your session…" />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/change-password"
        element={
          <RequireAuth>
            <ChangePassword />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />

        <Route
          path="students"
          element={
            <RequireRole roles={["Admin", "Teacher", "Accountant", "Parent"]}>
              <Students />
            </RequireRole>
          }
        />

        <Route
          path="teachers"
          element={
            <RequireRole roles={["Admin"]}>
              <Teachers />
            </RequireRole>
          }
        />

        <Route
          path="users"
          element={
            <RequireRole roles={["Admin"]}>
              <Users />
            </RequireRole>
          }
        />

        <Route
          path="roles"
          element={
            <RequireRole roles={["Admin"]}>
              <Roles />
            </RequireRole>
          }
        />

        <Route path="classes" element={<Classes />} />

        <Route
          path="subjects"
          element={
            <RequireRole roles={["Admin", "Teacher", "Student", "Parent"]}>
              <Subjects />
            </RequireRole>
          }
        />

        <Route path="timetable" element={<Timetable />} />

        <Route
          path="attendance"
          element={
            <RequireRole roles={["Admin", "Teacher", "Student", "Parent"]}>
              <Attendance />
            </RequireRole>
          }
        />

        <Route
          path="exams"
          element={
            <RequireRole roles={["Admin", "Teacher"]}>
              <Exams />
            </RequireRole>
          }
        />

        <Route
          path="results"
          element={
            <RequireRole roles={["Admin", "Teacher", "Student", "Parent"]}>
              <Results />
            </RequireRole>
          }
        />

        <Route
          path="fees"
          element={
            <RequireRole roles={["Admin", "Accountant"]}>
              <Fees />
            </RequireRole>
          }
        />

        <Route
          path="invoices"
          element={
            <RequireRole roles={["Admin", "Accountant", "Student", "Parent"]}>
              <Invoices />
            </RequireRole>
          }
        />

        <Route
          path="payments"
          element={
            <RequireRole roles={["Admin", "Accountant"]}>
              <Payments />
            </RequireRole>
          }
        />

        <Route
          path="checkout/:uuid"
          element={
            <RequireRole roles={["Admin", "Accountant", "Student", "Parent"]}>
              <Checkout />
            </RequireRole>
          }
        />

        <Route path="announcements" element={<Announcements />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="*"
        element={user ? <Navigate to="/" replace /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
