import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DEMO_ACCOUNTS } from "../lib/constants";
import { ErrorBanner, Spinner } from "../components/ui";

const HIGHLIGHTS = [
  { icon: GraduationCap, label: "Student records" },
  { icon: CalendarCheck, label: "Attendance" },
  { icon: Wallet, label: "Fees & payments" },
  { icon: ShieldCheck, label: "Role-based access" },
];

export default function Login() {
  const { login, user, booting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Sign in · School ERP";
  }, []);

  if (!booting && user) {
    return <Navigate to={user.must_change_password ? "/change-password" : "/"} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(email.trim(), password);
      toast.success(`Welcome back, ${signedIn.first_name || signedIn.full_name}.`, "Signed in");
      const target = location.state?.from?.pathname || "/";
      navigate(signedIn.must_change_password ? "/change-password" : target, { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <div className="brand-mark">
            <GraduationCap size={22} />
          </div>
          <div className="brand-text">
            <strong>School ERP</strong>
            <span>Management console</span>
          </div>
        </div>

        <div className="auth-hero">
          <h1>
            Everything your school needs, <em>in one calm place.</em>
          </h1>
          <p>
            Admissions, attendance, examinations and finance — connected so your
            team can spend less time on admin and more time on students.
          </p>
          <div className="auth-features">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <span className="auth-feature" key={label}>
                <Icon size={14} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="auth-foot">
          © {new Date().getFullYear()} School ERP · Built for schools that care about the details.
        </div>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p className="lead">Sign in with the email address provided by your school.</p>

          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input-wrap">
                <Mail
                  size={17}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                  }}
                />
                <input
                  id="email"
                  type="email"
                  className="input"
                  style={{ paddingLeft: 38 }}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.example"
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <Lock
                  size={17}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                  }}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="input"
                  style={{ paddingLeft: 38 }}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="icon-btn trail"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 6 }}>
              {submitting ? <Spinner size={17} light /> : null}
              {submitting ? "Signing in…" : "Sign in"}
              {!submitting ? <ArrowRight size={17} /> : null}
            </button>
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <Link to="/forgot-password" className="link-muted" style={{ fontSize: 12.5 }}>
                Forgot your password?
              </Link>
            </div>
          </form>

          <div className="auth-demo">
            <div className="label">Demo accounts</div>
            <div className="demo-chips">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  type="button"
                  className="demo-chip"
                  key={account.email}
                  onClick={() => useDemo(account)}
                  title={`${account.email} / ${account.password}`}
                >
                  {account.role}
                </button>
              ))}
            </div>
            <p className="help" style={{ marginTop: 8 }}>
              Click a role to fill its demo credentials. The admin account can manage everything.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
