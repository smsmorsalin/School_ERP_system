import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Camera,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Smartphone,
  UserCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Notice,
  PageHeader,
  RoleBadges,
  Spinner,
  StatusBadge,
} from "../components/ui";

const emptyForm = {
  first_name: "",
  last_name: "",
  phone_number: "",
  date_of_birth: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postal_code: "",
};

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    document.title = "My profile · School ERP";
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone_number: user.phone_number || "",
      date_of_birth: user.date_of_birth || "",
      address: user.address || "",
      city: user.city || "",
      state: user.state || "",
      country: user.country || "",
      postal_code: user.postal_code || "",
    });
  }, [user]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    api
      .get("/accounts/auth/me/login-history/")
      .then((data) => {
        if (active) setHistory(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview]
  );

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const chooseAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile images must be 2 MB or smaller.");
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let payload;
      if (avatarFile) {
        payload = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          payload.append(key, value ?? "");
        });
        payload.append("profile_image", avatarFile);
      } else {
        payload = { ...form };
      }
      await api.patch("/accounts/auth/me/", payload);
      await refreshUser();
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      toast.success("Your profile has been updated.");
    } catch (err) {
      setError(err);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Your personal details, photo and account security"
        actions={
          <Link to="/change-password" className="btn btn-secondary">
            <KeyRound size={16} /> Change password
          </Link>
        }
      />

      <div className="profile-head">
        <div style={{ position: "relative" }}>
          <Avatar
            name={user.full_name}
            src={avatarPreview || user.profile_image_url}
            size="lg"
            className="profile-avatar"
          />
          <button
            type="button"
            className="avatar-edit"
            title="Change profile photo"
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseAvatar}
            style={{ display: "none" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3>{user.full_name}</h3>
            {user.is_active ? (
              <Badge tone="green" dot>
                Active
              </Badge>
            ) : (
              <Badge tone="red" dot>
                Inactive
              </Badge>
            )}
          </div>
          <p>{user.email}</p>
          <div className="profile-chips">
            <RoleBadges roles={user.roles} />
            {user.must_change_password ? <Badge tone="amber">Password change required</Badge> : null}
          </div>
        </div>
        <div className="profile-meta">
          <span>
            <BadgeCheck size={14} /> Member since {formatDate(user.created_at)}
          </span>
          <span>
            <Clock size={14} /> Last sign-in {user.last_login ? formatDateTime(user.last_login) : "—"}
          </span>
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div className="grid-main-side">
        <Card title="Personal details" subtitle="Keep your contact information up to date">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          <form onSubmit={submit}>
            <div className="field-row">
              <Field label="First name" required>
                <input className="input" value={form.first_name} onChange={set("first_name")} required />
              </Field>
              <Field label="Last name" required>
                <input className="input" value={form.last_name} onChange={set("last_name")} required />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Email address" hint="Contact an administrator to change your sign-in email.">
                <div className="input-wrap">
                  <input className="input" value={user.email} readOnly disabled />
                  <Mail size={15} className="input-icon" />
                </div>
              </Field>
              <Field label="Phone number">
                <div className="input-wrap">
                  <input
                    className="input"
                    value={form.phone_number}
                    onChange={set("phone_number")}
                    autoComplete="tel"
                  />
                  <Phone size={15} className="input-icon" />
                </div>
              </Field>
            </div>
            <div className="field-row">
              <Field label="Date of birth">
                <input
                  className="input"
                  type="date"
                  value={form.date_of_birth || ""}
                  onChange={set("date_of_birth")}
                />
              </Field>
              <Field label="City">
                <input className="input" value={form.city} onChange={set("city")} autoComplete="address-level2" />
              </Field>
            </div>
            <div className="field-row">
              <Field label="State / region">
                <input className="input" value={form.state} onChange={set("state")} autoComplete="address-level1" />
              </Field>
              <Field label="Country">
                <input className="input" value={form.country} onChange={set("country")} autoComplete="country-name" />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Address" className="span-2">
                <textarea
                  className="input"
                  rows={2}
                  value={form.address}
                  onChange={set("address")}
                  autoComplete="street-address"
                />
              </Field>
            </div>
            <Field label="Postal code">
              <input
                className="input"
                value={form.postal_code}
                onChange={set("postal_code")}
                autoComplete="postal-code"
                style={{ maxWidth: 220 }}
              />
            </Field>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <Spinner size={16} light /> : <Save size={16} />}
                {busy ? "Saving…" : "Save changes"}
              </button>
              {avatarFile ? (
                <span className="cell-sub">
                  New photo “{avatarFile.name}” will upload with your changes.
                </span>
              ) : null}
            </div>
          </form>
        </Card>

        <div>
          <Card title="Account" subtitle="Managed by your school">
            <dl className="kv">
              <dt>Email</dt>
              <dd style={{ wordBreak: "break-all" }}>{user.email}</dd>
              <dt>Primary role</dt>
              <dd>{user.primary_role}</dd>
              <dt>All roles</dt>
              <dd>
                <RoleBadges roles={user.roles} />
              </dd>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={user.is_active ? "active" : "inactive"}>
                  {user.is_active ? "Active" : "Inactive"}
                </StatusBadge>
              </dd>
              <dt>Member since</dt>
              <dd>{formatDate(user.created_at)}</dd>
            </dl>
            <div style={{ height: 14 }} />
            <Notice tone="info" icon={ShieldCheck}>
              Your email address and roles can only be changed by a school administrator.
            </Notice>
          </Card>

          <Card title="Security" subtitle="Session and password">
            <div className="security-row">
              <div>
                <strong>Password</strong>
                <span className="cell-sub">Use a unique password you do not reuse elsewhere.</span>
              </div>
              <Link to="/change-password" className="btn btn-secondary btn-sm">
                <KeyRound size={14} /> Change
              </Link>
            </div>
            <div className="security-row">
              <div>
                <strong>Current session</strong>
                <span className="cell-sub">Signing out closes this browser session.</span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
            <div className="security-row">
              <div>
                <strong>Session protection</strong>
                <span className="cell-sub">
                  Access tokens stay in memory; refresh tokens are HttpOnly cookies.
                </span>
              </div>
              <ShieldCheck size={18} style={{ color: "var(--success)" }} />
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Recent sign-in activity"
        subtitle="The latest successful and failed attempts on your account"
        flush
      >
        {historyLoading ? (
          <Loading label="Loading activity…" />
        ) : history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>When</th>
                  <th>IP address</th>
                  <th>Device</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.uuid}>
                    <td>
                      <StatusBadge status={entry.status}>
                        {entry.status === "success"
                          ? "Success"
                          : entry.status === "logout"
                            ? "Signed out"
                            : "Failed"}
                      </StatusBadge>
                    </td>
                    <td>{formatDateTime(entry.login_time)}</td>
                    <td className="cell-sub">{entry.ip_address || "—"}</td>
                    <td className="cell-sub" style={{ textTransform: "capitalize" }}>
                      <Smartphone size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                      {entry.device_type || "—"}
                    </td>
                    <td className="cell-sub">{entry.failure_reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={UserCircle}
            title="No sign-in activity yet"
            description="Your future sign-in attempts will show up here."
          />
        )}
      </Card>
    </>
  );
}
