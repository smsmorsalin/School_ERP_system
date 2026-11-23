import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, KeyRound, Lock, ShieldCheck, Timer, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import {
  Card,
  ErrorBanner,
  Field,
  PageHeader,
  Spinner,
} from "../../components/ui";

function strength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong", "Very strong"];

/** In-console password change. The forced first-login flow stays at /change-password. */
export default function PasswordPage() {
  usePageTitle("Change password");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const score = strength(form.new_password);
  const matches = form.new_password_confirm && form.new_password === form.new_password_confirm;
  const mismatch = Boolean(form.new_password_confirm) && !matches;

  const rules = [
    { label: "At least 8 characters", ok: form.new_password.length >= 8 },
    { label: "Upper and lowercase letters", ok: /[A-Z]/.test(form.new_password) && /[a-z]/.test(form.new_password) },
    { label: "At least one number", ok: /\d/.test(form.new_password) },
    { label: "At least one symbol", ok: /[^A-Za-z0-9]/.test(form.new_password) },
    { label: "Passwords match", ok: matches },
  ];

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
      toast.success("Your password has been updated. Sign in again with your new password.", "Password changed");
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
    <>
      <PageHeader
        title="Change password"
        subtitle="Update the password you use to sign in to the school console."
        meta={
          <span className="page-meta-text">
            <ShieldCheck size={13} /> Signed in as {user?.email}
          </span>
        }
      />

      <div className="grid-main-side">
        <Card title="Set a new password" subtitle="You will be signed out and asked to sign in again.">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          <form onSubmit={submit}>
            <Field label="Current password" required>
              <div className="input-wrap">
                <input
                  type="password"
                  className="input"
                  value={form.old_password}
                  onChange={set("old_password")}
                  autoComplete="current-password"
                  required
                />
                <Lock size={15} className="input-icon" />
              </div>
            </Field>

            <Field label="New password" required>
              <div className="input-wrap">
                <input
                  type="password"
                  className="input"
                  value={form.new_password}
                  onChange={set("new_password")}
                  autoComplete="new-password"
                  required
                />
                <KeyRound size={15} className="input-icon" />
              </div>
              {form.new_password ? (
                <div className="pw-strength">
                  <div className="pw-strength-bars" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <span
                        key={step}
                        className={score >= step ? (score <= 2 ? "bad" : score <= 3 ? "warn" : "good") : ""}
                      />
                    ))}
                  </div>
                  <span className="pw-strength-label">{LABELS[score]}</span>
                </div>
              ) : null}
            </Field>

            <Field label="Confirm new password" required>
              <div className="input-wrap">
                <input
                  type="password"
                  className="input"
                  value={form.new_password_confirm}
                  onChange={set("new_password_confirm")}
                  autoComplete="new-password"
                  required
                />
                <Lock size={15} className="input-icon" />
              </div>
              {mismatch ? <span className="field-error">Passwords do not match yet.</span> : null}
            </Field>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={busy || mismatch}>
                {busy ? <Spinner size={16} light /> : <KeyRound size={16} />}
                {busy ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </Card>

        <div>
          <Card title="Password rules" subtitle="Checked automatically before saving">
            <ul className="pw-rules">
              {rules.map((rule) => (
                <li key={rule.label} className={rule.ok ? "ok" : ""}>
                  {rule.ok ? <Check size={14} /> : <X size={14} />}
                  {rule.label}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Why we sign you out" subtitle="Session protection">
            <p className="card-note">
              Changing your password revokes every active refresh token on this account. Signing in again
              confirms the new password works and closes any session opened with the old one.
            </p>
            <div className="security-row" style={{ marginTop: 12 }}>
              <div>
                <strong>Token rotation</strong>
                <span className="cell-sub">Old sessions stop working immediately.</span>
              </div>
              <Timer size={18} style={{ color: "var(--accent)" }} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
