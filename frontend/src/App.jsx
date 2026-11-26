import { Link, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
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
import StudentDetail from "./pages/StudentDetail";
import AdmissionsPage from "./pages/students/AdmissionsPage";
import Teachers from "./pages/Teachers";
import ClassesPage from "./pages/academics/ClassesPage";
import SectionsPage from "./pages/academics/SectionsPage";
import SubjectsPage from "./pages/academics/SubjectsPage";
import CurriculumPage from "./pages/academics/CurriculumPage";
import Timetable from "./pages/Timetable";
import RegisterPage from "./pages/attendance/RegisterPage";
import RecordsPage from "./pages/attendance/RecordsPage";
import MyAttendancePage from "./pages/attendance/MyAttendancePage";
import Exams from "./pages/Exams";
import ExamWorkspace, { ExamMarksPage } from "./pages/ExamWorkspace";
import Results from "./pages/Results";
import FeeStructuresPage from "./pages/finance/FeeStructuresPage";
import FeeCategoriesPage from "./pages/finance/FeeCategoriesPage";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Payments from "./pages/Payments";
import Checkout from "./pages/Checkout";
import Announcements from "./pages/Announcements";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Roles from "./pages/Roles";
import Audit from "./pages/Audit";
import SettingsPage from "./pages/admin/SettingsPage";
import Profile from "./pages/Profile";
import PasswordPage from "./pages/account/PasswordPage";
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

/** Old bookmarks land on the new dedicated attendance page for their role. */
function LegacyAttendanceRedirect() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const staff = roles.some((role) => ["Admin", "Teacher"].includes(role));
  return <Navigate to={staff ? "/attendance/register" : "/attendance/mine"} replace />;
}

function LegacyInvoiceRedirect() {
  const { uuid } = useParams();
  return <Navigate to={`/finance/invoices/${uuid}`} replace />;
}

function LegacyUserRedirect() {
  const { uuid } = useParams();
  return <Navigate to={`/admin/users/${uuid}`} replace />;
}

function LegacyCheckoutRedirect() {
  const { uuid } = useParams();
  return <Navigate to={`/finance/checkout/${uuid}`} replace />;
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
            <RequireRole roles={["Admin", "Teacher", "Accountant", "Parent", "Student"]}>
              <Students />
            </RequireRole>
          }
        />
        <Route
          path="students/new"
          element={
            <RequireRole roles={["Admin"]}>
              <AdmissionsPage />
            </RequireRole>
          }
        />
        <Route
          path="students/:uuid"
          element={
            <RequireRole roles={["Admin", "Teacher", "Accountant"]}>
              <StudentDetail />
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

        <Route path="academics/classes" element={<ClassesPage />} />
        <Route path="academics/sections" element={<SectionsPage />} />
        <Route
          path="academics/subjects"
          element={
            <RequireRole roles={["Admin", "Teacher", "Student", "Parent"]}>
              <SubjectsPage />
            </RequireRole>
          }
        />
        <Route
          path="academics/curriculum"
          element={
            <RequireRole roles={["Admin", "Teacher", "Student", "Parent"]}>
              <CurriculumPage />
            </RequireRole>
          }
        />
        <Route path="academics/timetable" element={<Timetable />} />

        <Route
          path="attendance/register"
          element={
            <RequireRole roles={["Admin", "Teacher"]}>
              <RegisterPage />
            </RequireRole>
          }
        />
        <Route
          path="attendance/records"
          element={
            <RequireRole roles={["Admin", "Teacher"]}>
              <RecordsPage />
            </RequireRole>
          }
        />
        <Route
          path="attendance/mine"
          element={
            <RequireRole roles={["Student", "Parent"]}>
              <MyAttendancePage />
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
          path="exams/:uuid"
          element={
            <RequireRole roles={["Admin", "Teacher"]}>
              <ExamWorkspace view="papers" />
            </RequireRole>
          }
        />
        <Route
          path="exams/:uuid/analytics"
          element={
            <RequireRole roles={["Admin", "Teacher"]}>
              <ExamWorkspace view="analytics" />
            </RequireRole>
          }
        />
        <Route
          path="exams/:uuid/papers/:paperUuid"
          element={
            <RequireRole roles={["Admin", "Teacher"]}>
              <ExamMarksPage />
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
          path="finance/fee-structures"
          element={
            <RequireRole roles={["Admin", "Accountant"]}>
              <FeeStructuresPage />
            </RequireRole>
          }
        />
        <Route
          path="finance/fee-categories"
          element={
            <RequireRole roles={["Admin", "Accountant"]}>
              <FeeCategoriesPage />
            </RequireRole>
          }
        />
        <Route
          path="finance/invoices"
          element={
            <RequireRole roles={["Admin", "Accountant", "Student", "Parent"]}>
              <Invoices />
            </RequireRole>
          }
        />
        <Route
          path="finance/invoices/:uuid"
          element={
            <RequireRole roles={["Admin", "Accountant", "Student", "Parent"]}>
              <InvoiceDetail />
            </RequireRole>
          }
        />
        <Route
          path="finance/payments"
          element={
            <RequireRole roles={["Admin", "Accountant"]}>
              <Payments />
            </RequireRole>
          }
        />
        <Route
          path="finance/checkout/:uuid"
          element={
            <RequireRole roles={["Admin", "Accountant", "Student", "Parent"]}>
              <Checkout />
            </RequireRole>
          }
        />

        <Route path="communication/announcements" element={<Announcements />} />

        <Route
          path="admin/users"
          element={
            <RequireRole roles={["Admin"]}>
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="admin/users/:uuid"
          element={
            <RequireRole roles={["Admin"]}>
              <UserDetail />
            </RequireRole>
          }
        />
        <Route
          path="admin/roles"
          element={
            <RequireRole roles={["Admin"]}>
              <Roles />
            </RequireRole>
          }
        />
        <Route
          path="admin/audit"
          element={
            <RequireRole roles={["Admin"]}>
              <Audit />
            </RequireRole>
          }
        />
        <Route
          path="admin/settings"
          element={
            <RequireRole roles={["Admin"]}>
              <SettingsPage />
            </RequireRole>
          }
        />

        <Route path="account/profile" element={<Profile />} />
        <Route path="account/security/password" element={<PasswordPage />} />

        {/* Legacy URLs: keep old bookmarks working while the IA settles. */}
        <Route path="classes" element={<Navigate to="/academics/classes" replace />} />
        <Route path="sections" element={<Navigate to="/academics/sections" replace />} />
        <Route path="subjects" element={<Navigate to="/academics/subjects" replace />} />
        <Route path="subjects/assignments" element={<Navigate to="/academics/curriculum" replace />} />
        <Route path="timetable" element={<Navigate to="/academics/timetable" replace />} />
        <Route path="attendance" element={<LegacyAttendanceRedirect />} />
        <Route path="fees" element={<Navigate to="/finance/fee-structures" replace />} />
        <Route path="fees/categories" element={<Navigate to="/finance/fee-categories" replace />} />
        <Route path="invoices" element={<Navigate to="/finance/invoices" replace />} />
        <Route path="invoices/:uuid" element={<LegacyInvoiceRedirect />} />
        <Route path="payments" element={<Navigate to="/finance/payments" replace />} />
        <Route path="checkout/:uuid" element={<LegacyCheckoutRedirect />} />
        <Route path="announcements" element={<Navigate to="/communication/announcements" replace />} />
        <Route path="users" element={<Navigate to="/admin/users" replace />} />
        <Route path="users/:uuid" element={<LegacyUserRedirect />} />
        <Route path="roles" element={<Navigate to="/admin/roles" replace />} />
        <Route path="audit" element={<Navigate to="/admin/audit" replace />} />
        <Route path="profile" element={<Navigate to="/account/profile" replace />} />
        <Route path="account/security" element={<Navigate to="/account/profile" replace />} />

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="*"
        element={user ? <Navigate to="/" replace /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
