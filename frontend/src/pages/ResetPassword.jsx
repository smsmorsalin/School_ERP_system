import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, GraduationCap, KeyRound, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { ErrorBanner, Field, Notice, Spinner } from "../components/ui";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [form, setForm] = useState({ new_password: "", new_password_confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Choose a new password · School ERP";
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (form.new_password !== form.new_password_confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post(
        "/accounts/auth/password-reset/confirm/",
        { uid, token, ...form },
        { retry: false }
      );
      toast.success("Your password has been reset. Sign in with the new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const invalidLink = !uid || !token;

  return (
    <div className="auth-page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: 460 }}>
        <div className="card-body" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
            <div className="brand-mark">
              <GraduationCap size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 18 }}>School ERP</h3>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Account recovery</p>
            </div>
          </div>

          <h2 style={{ fontSize: 22 }}>Choose a new password</h2>
          <p style={{ color: "var(--text-2)", fontSize: 13, margin: "5px 0 18px" }}>
            Pick a strong password you do not use on other sites.
          </p>

          {invalidLink ? (
            <>
              <Notice tone="danger" icon={ShieldCheck}>
                This reset link is incomplete or invalid. Request a new one from the
                sign-in page.
              </Notice>
              <Link to="/forgot-password" className="btn btn-primary btn-block" style={{ marginTop: 16, textDecoration: "none" }}>
                Request a new link
              </Link>
            </>
          ) : (
            <>
              <ErrorBanner error={error} onDismiss={() => setError(null)} />
              <form onSubmit={submit}>
                <Field
                  label="New password"
                  required
                  hint="At least 10 characters with uppercase, lowercase, a number and a symbol."
                >
                  <div className="input-wrap">
                    <input
                      className="input"
                      type={show ? "text" : "password"}
                      value={form.new_password}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, new_password: event.target.value }))
                      }
                      autoComplete="new-password"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="icon-btn trail"
                      onClick={() => setShow((value) => !value)}
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      <ShieldCheck size={16} />
                    </button>
                  </div>
                </Field>
                <Field label="Confirm new password" required>
                  <input
                    className="input"
                    type={show ? "text" : "password"}
                    value={form.new_password_confirm}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        new_password_confirm: event.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? <Spinner size={16} light /> : <KeyRound size={16} />}
                  {busy ? "Updating…" : "Reset password"}
                </button>
              </form>
              <Link
                to="/login"
                className="btn btn-ghost btn-block"
                style={{ marginTop: 8, textDecoration: "none" }}
              >
                <ArrowLeft size={15} /> Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
