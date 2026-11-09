import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, GraduationCap, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { ErrorBanner, Field, Notice, Spinner } from "../components/ui";

function strength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export default function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const forced = Boolean(user?.must_change_password);
  const [form, setForm] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Change password · School ERP";
  }, []);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const score = strength(form.new_password);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (form.new_password !== form.new_password_confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/accounts/auth/change-password/", form);
      toast.success(
        "Your password has been updated. Sign in again with your new password.",
        "Password changed"
      );
      // The server revokes every refresh token after a password change, so a
      // clean sign-in is the only way to obtain a fresh session.
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "40px 18px",
        background: "linear-gradient(160deg, #f4f6fb 0%, #eef2ff 100%)",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 480 }}>
        <div className="card-body" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div className="brand-mark">
              <GraduationCap size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 18 }}>School ERP</h3>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Account security</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={logout}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>

          <h2 style={{ fontSize: 22 }}>{forced ? "Set a new password" : "Change your password"}</h2>
          <p style={{ color: "var(--text-2)", fontSize: 13, margin: "5px 0 18px" }}>
            {forced
              ? "Your account was created with a temporary password. Choose a private password to continue."
              : "Choose a strong password you do not use anywhere else."}
          </p>

          {forced ? (
            <Notice tone="warning" icon={ShieldCheck}>
              For everyone&apos;s security, the dashboard stays locked until you update your password.
            </Notice>
          ) : null}

          <div style={{ height: 14 }} />
          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          <form onSubmit={submit}>
            <Field label="Current password" required>
              <div className="input-wrap">
                <input
                  type={show ? "text" : "password"}
                  className="input"
                  value={form.old_password}
                  onChange={set("old_password")}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="icon-btn trail"
                  onClick={() => setShow((value) => !value)}
                  aria-label="Toggle password visibility"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field
              label="New password"
              required
              hint="At least 8 characters, mixing letters, numbers and symbols."
            >
              <input
                type={show ? "text" : "password"}
                className="input"
                value={form.new_password}
                onChange={set("new_password")}
                autoComplete="new-password"
                required
              />
              {form.new_password ? (
                <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span
                      key={step}
                      style={{
                        height: 4,
                        flex: 1,
                        borderRadius: 4,
                        background:
                          score >= step
                            ? score <= 2
                              ? "var(--danger)"
                              : score <= 3
                                ? "var(--warning)"
                                : "var(--success)"
                            : "#e6eaf2",
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </Field>
            <Field label="Confirm new password" required>
              <input
                type={show ? "text" : "password"}
                className="input"
                value={form.new_password_confirm}
                onChange={set("new_password_confirm")}
                autoComplete="new-password"
                required
              />
            </Field>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? <Spinner size={17} light /> : <KeyRound size={17} />}
              {busy ? "Updating…" : "Update password"}
            </button>
            {!forced ? (
              <Link
                to="/"
                className="btn btn-ghost btn-block"
                style={{ marginTop: 8, textDecoration: "none" }}
              >
                <ArrowLeft size={15} /> Back to dashboard
              </Link>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
