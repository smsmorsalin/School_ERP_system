import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  Megaphone,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { usePageTitle } from "../lib/usePageTitle";
import { useToast } from "../context/ToastContext";
import { withEmphasis } from "../lib/emphasis";
import { DEMO_ACCOUNTS } from "../lib/constants";
import { ErrorBanner, Spinner } from "../components/ui";

const HIGHLIGHTS = [
  { icon: GraduationCap, label: "Student records" },
  { icon: CalendarCheck, label: "Attendance" },
  { icon: Wallet, label: "Fees & payments" },
  { icon: ShieldCheck, label: "Role-based access" },
];

export default function Login() {
  usePageTitle("Sign in");
  const { login, user, booting } = useAuth();
  const { settings, schoolName, brandLine } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          {settings.logo_url ? (
            <img className="brand-logo" src={settings.logo_url} alt="" />
          ) : (
            <div className="brand-mark">
              <GraduationCap size={22} />
            </div>
          )}
          <div className="brand-text">
            <strong>{schoolName}</strong>
            <span>{brandLine}</span>
          </div>
        </div>

        <div className="auth-hero">
          <h1>{withEmphasis(settings.login_headline)}</h1>
          {settings.login_subtext ? <p>{settings.login_subtext}</p> : null}
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
          <span>
            © {new Date().getFullYear()} {schoolName} · Built for schools that care about
            the details.
          </span>
          {settings.email || settings.phone || settings.website ? (
            <span className="auth-contact">
              {settings.email ? (
                <a href={`mailto:${settings.email}`}>{settings.email}</a>
              ) : null}
              {settings.phone ? <span>{settings.phone}</span> : null}
              {settings.website ? (
                <a href={settings.website} target="_blank" rel="noreferrer">
                  {settings.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </span>
          ) : null}
        </div>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          {settings.login_notice ? (
            <div className="auth-notice" role="note">
              <Megaphone size={15} aria-hidden="true" />
              <span>{settings.login_notice}</span>
            </div>
          ) : null}
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
    </main>
  );
}
