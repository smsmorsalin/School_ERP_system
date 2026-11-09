import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Banknote,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { usePageTitle } from "../lib/usePageTitle";
import { formatDate, relativeTime } from "../lib/format";
import { Avatar, Badge } from "./ui";

const all = (...roles) => roles;

const NAV_GROUPS = [
  {
    title: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, roles: all("Admin", "Teacher", "Accountant", "Student", "Parent") }],
  },
  {
    title: "People",
    items: [
      { to: "/students", label: "Students", icon: GraduationCap, roles: all("Admin", "Teacher", "Accountant") },
      { to: "/students", label: "My children", icon: GraduationCap, roles: all("Parent") },
      { to: "/teachers", label: "Teachers", icon: Users, roles: all("Admin") },
      { to: "/users", label: "User accounts", icon: UserCircle, roles: all("Admin") },
      { to: "/roles", label: "Roles & access", icon: ShieldCheck, roles: all("Admin") },
    ],
  },
  {
    title: "Academics",
    items: [
      { to: "/classes", label: "Classes & sections", icon: BookOpen, roles: all("Admin", "Teacher", "Accountant", "Student", "Parent") },
      { to: "/subjects", label: "Subjects", icon: ClipboardList, roles: all("Admin", "Teacher", "Student", "Parent") },
      { to: "/timetable", label: "Timetable", icon: CalendarDays, roles: all("Admin", "Teacher", "Accountant", "Student", "Parent") },
    ],
  },
  {
    title: "Daily operations",
    items: [
      { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: all("Admin", "Teacher", "Student", "Parent") },
      { to: "/exams", label: "Examinations", icon: FileSpreadsheet, roles: all("Admin", "Teacher") },
      { to: "/results", label: "Results", icon: GraduationCap, roles: all("Admin", "Teacher", "Student", "Parent") },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/invoices", label: "Invoices", icon: Receipt, roles: all("Admin", "Accountant", "Student", "Parent") },
      { to: "/fees", label: "Fee setup", icon: Wallet, roles: all("Admin", "Accountant") },
      { to: "/payments", label: "Payments", icon: Banknote, roles: all("Admin", "Accountant") },
    ],
  },
  {
    title: "Communication",
    items: [{ to: "/announcements", label: "Announcements", icon: Megaphone, roles: all("Admin", "Teacher", "Accountant", "Student", "Parent") }],
  },
];

const TITLES = {
  "/": ["Dashboard", "A live overview of your school"],
  "/students": ["Students", "Student records and admissions"],
  "/teachers": ["Teachers", "Teaching staff directory"],
  "/classes": ["Classes & sections", "Class structure and rosters"],
  "/subjects": ["Subjects", "Curriculum and subject assignments"],
  "/timetable": ["Timetable", "Weekly class schedule"],
  "/attendance": ["Attendance", "Daily attendance and trends"],
  "/exams": ["Examinations", "Exam setup, mark entry and publishing"],
  "/results": ["Results", "Marks, grades and report cards"],
  "/fees": ["Fee setup", "Fee categories and class fees"],
  "/invoices": ["Invoices", "Billing and outstanding balances"],
  "/payments": ["Payments", "Collections and receipts"],
  "/announcements": ["Announcements", "School-wide communication"],
  "/users": ["User accounts", "Accounts, roles and access"],
  "/roles": ["Roles & access", "Roles and permission matrix"],
  "/profile": ["My profile", "Personal details and security"],
  "/change-password": ["Change password", "Keep your account secure"],
};

function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin, hasRole } = useAuth();
  const roleSet = user?.roles || [];

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.roles.some((role) => roleSet.includes(role))),
      })).filter((group) => group.items.length),
    [roleSet]
  );

  return (
    <>
      {open ? <div className="sidebar-backdrop" onClick={onClose} /> : null}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <GraduationCap size={22} />
          </div>
          <div className="brand-text">
            <strong>School ERP</strong>
            <span>Management console</span>
          </div>
          <button
            type="button"
            className="icon-btn mobile-only"
            style={{ marginLeft: "auto", color: "#cbd5e1" }}
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={`${group.title}-${item.to}-${item.label}`}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                    onClick={onClose}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/profile" className="sidebar-user" onClick={onClose}>
            <Avatar name={user?.full_name} src={user?.profile_image_url} size="sm" />
            <div className="meta">
              <strong>{user?.full_name}</strong>
              <span>{user?.primary_role || "Member"}</span>
            </div>
            {isAdmin || hasRole("Admin") ? <Settings size={14} /> : null}
          </NavLink>
          <button
            type="button"
            className="nav-link"
            style={{ width: "100%", background: "none", border: 0, cursor: "pointer", marginTop: 4 }}
            onClick={logout}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query, 300);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults(null);
      return;
    }
    let active = true;
    api
      .get("/dashboard/search/", { q: debounced.trim() })
      .then((data) => {
        if (active) setResults(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [debounced]);

  useEffect(() => {
    const handler = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const students = results?.students || [];
  const classes = results?.classes || [];
  const hasResults = students.length || classes.length;

  return (
    <div className="global-search" ref={boxRef}>
      <Search size={16} />
      <input
        value={query}
        placeholder="Search students, classes…"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Global search"
      />
      {open && query.trim().length >= 2 ? (
        <div className="search-pop">
          {students.length ? (
            <div className="search-pop-section">
              <div className="search-pop-label">Students</div>
              {students.map((student) => (
                <button
                  type="button"
                  className="search-hit"
                  key={student.uuid}
                  style={{ width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left" }}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    navigate(`/students?student=${student.uuid}`);
                  }}
                >
                  <Avatar name={student.name} size="sm" />
                  <span>
                    {student.name}
                    <span className="sub">{student.student_id}</span>
                  </span>
                  <span className="sub">{student.section || ""}</span>
                </button>
              ))}
            </div>
          ) : null}
          {classes.length ? (
            <div className="search-pop-section">
              <div className="search-pop-label">Classes</div>
              {classes.map((item) => (
                <button
                  type="button"
                  className="search-hit"
                  key={item.uuid}
                  style={{ width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left" }}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    navigate(`/attendance?section=${item.uuid}`);
                  }}
                >
                  <BookOpen size={15} />
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}
          {!hasResults ? (
            <div style={{ padding: "16px 14px", color: "var(--muted)", fontSize: 12.5 }}>
              No matches for “{query.trim()}”.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  const load = () => {
    Promise.all([
      api.get("/announcements/", { page_size: 6, ordering: "-published_at" }),
      api.get("/announcements/unread-count/"),
    ])
      .then(([list, counts]) => {
        setItems(list.results || []);
        setUnread(counts.unread || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 120000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    setBusy(true);
    try {
      await api.post("/announcements/mark-all-read/", {});
      setUnread(0);
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      toast.success("All announcements marked as read.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        className="topbar-icon"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 ? <span className="dot" /> : null}
      </button>
      {open ? (
        <div
          className="search-pop"
          style={{ width: 340, right: 0, left: "auto", top: 47 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <strong style={{ fontSize: 13 }}>Announcements</strong>
            {unread > 0 ? <Badge tone="red">{unread} unread</Badge> : null}
          </div>
          <div style={{ maxHeight: 330, overflowY: "auto" }}>
            {items.length ? (
              items.map((item) => (
                <button
                  type="button"
                  key={item.uuid}
                  onClick={() => {
                    setOpen(false);
                    navigate("/announcements");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    borderBottom: "1px solid var(--border)",
                    background: item.is_read ? "#fff" : "#f8faff",
                    padding: "10px 14px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", gap: 6 }}>
                    {item.is_pinned ? <Badge tone="amber">Pinned</Badge> : null}
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {item.audience_display} · {relativeTime(item.published_at || item.created_at)}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: 18, color: "var(--muted)", fontSize: 12.5 }}>
                No announcements yet.
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setOpen(false);
                navigate("/announcements");
              }}
            >
              View all
            </button>
            {unread > 0 ? (
              <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={markAll} disabled={busy}>
                Mark all read
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          border: "1px solid var(--border)",
          background: "#fff",
          borderRadius: 11,
          padding: "4px 8px 4px 4px",
          cursor: "pointer",
        }}
      >
        <Avatar name={user?.full_name} src={user?.profile_image_url} size="sm" />
        <span style={{ textAlign: "left", lineHeight: 1.2 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 650, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.full_name}
          </span>
          <span style={{ display: "block", fontSize: 10.5, color: "var(--muted)" }}>{user?.primary_role}</span>
        </span>
        <ChevronDown size={14} style={{ color: "var(--muted)" }} />
      </button>
      {open ? (
        <div
          className="search-pop"
          style={{ width: 230, right: 0, left: "auto", top: 48 }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 650 }}>{user?.full_name}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{user?.email}</div>
          </div>
          <div style={{ padding: 6 }}>
            <button
              type="button"
              className="search-hit"
              style={{ width: "100%", border: 0, background: "none", cursor: "pointer" }}
              onClick={() => {
                setOpen(false);
                navigate("/profile");
              }}
            >
              <UserCircle size={15} /> My profile
            </button>
            <button
              type="button"
              className="search-hit"
              style={{ width: "100%", border: 0, background: "none", cursor: "pointer" }}
              onClick={() => {
                setOpen(false);
                navigate("/change-password");
              }}
            >
              <ShieldCheck size={15} /> Change password
            </button>
            <button
              type="button"
              className="search-hit"
              style={{ width: "100%", border: 0, background: "none", cursor: "pointer", color: "var(--danger)" }}
              onClick={logout}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const [title, subtitle] = TITLES[location.pathname] || ["School ERP", "Management console"];
  usePageTitle(title);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn mobile-only"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-spacer" />
          <GlobalSearch />
          <Notifications />
          <UserMenu />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
