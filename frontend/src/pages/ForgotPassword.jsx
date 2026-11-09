import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, GraduationCap, Mail, Send } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner, Field, Notice, Spinner } from "../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Reset password · School ERP";
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post(
        "/accounts/auth/password-reset/",
        { email: email.trim() },
        { retry: false }
      );
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

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

          <h2 style={{ fontSize: 22 }}>Reset your password</h2>
          <p style={{ color: "var(--text-2)", fontSize: 13, margin: "5px 0 18px" }}>
            Enter the email address linked to your account. If it exists, we will send a
            secure reset link.
          </p>

          {sent ? (
            <>
              <Notice tone="success">
                If an account exists for <strong>{email}</strong>, a reset link is on its way.
                The link expires after 3 days. Check your spam folder if you do not see it.
              </Notice>
              <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: 16, textDecoration: "none" }}>
                <ArrowLeft size={15} /> Back to sign in
              </Link>
            </>
          ) : (
            <>
              <ErrorBanner error={error} onDismiss={() => setError(null)} />
              <form onSubmit={submit}>
                <Field label="Email address" required>
                  <div className="input-wrap">
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@school.example"
                      autoComplete="email"
                      required
                      autoFocus
                    />
                    <Mail size={16} className="input-icon" />
                  </div>
                </Field>
                <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? <Spinner size={16} light /> : <Send size={16} />}
                  {busy ? "Sending…" : "Send reset link"}
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
