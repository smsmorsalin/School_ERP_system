import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  KeyRound,
  Pencil,
  ShieldCheck,
  Trash2,
  Unlock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../lib/usePageTitle";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { ROLES } from "../lib/constants";
import { formatDate, formatDateTime, relativeTime } from "../lib/format";
import { useAll, useFetch } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Loading,
  RoleBadges,
  StatCard,
  StatusBadge,
} from "../components/ui";
import { LoginHistoryTable, SetPasswordModal, UserFormModal } from "./Users";

/**
 * One account, one page: profile, access, sign-in activity and lifecycle
 * controls each get their own section instead of a row of icons.
 */
export default function UserDetail() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const state = useFetch(`/accounts/users/${uuid}/`, { deps: [uuid] });
  const { data: roles } = useAll("/accounts/roles/", { ordering: "name" });
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const account = state.data;
  const isSelf = account?.uuid === currentUser?.uuid;

  const roleOptions = useMemo(() => {
    const names = roles.filter((role) => role.is_active !== false).map((role) => role.name);
    return names.length ? names : ROLES;
  }, [roles]);

  usePageTitle(account ? account.full_name : "User account");

  const toggleActive = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const response = await api.post(`/accounts/users/${uuid}/toggle-active/`, {});
      toast.success(response?.detail || "Account status updated.");
      state.reload();
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const response = await api.post(`/accounts/users/${uuid}/unlock/`, {});
      toast.success(response?.detail || "Account unlocked.");
      state.reload();
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/accounts/users/${uuid}/`);
      toast.success("Account deactivated and detached from active roles.");
      navigate("/users", { replace: true });
    } catch (error) {
      setActionError(error);
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) {
    return <Loading label="Loading account…" />;
  }

  if (state.error) {
    return (
      <>
        <Breadcrumbs items={[{ label: "User accounts", to: "/users" }, { label: "Account" }]} />
        <ErrorBanner error={state.error} />
      </>
    );
  }

  if (!account) {
    return (
      <>
        <Breadcrumbs items={[{ label: "User accounts", to: "/users" }, { label: "Account" }]} />
        <Card><EmptyState icon={ShieldCheck} title="Account not found" description="It may have been removed or you may not have access." /></Card>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "User accounts", to: "/users" }, { label: account.full_name }]} />

      <div className="detail-hero">
        <Avatar name={account.full_name} src={account.profile_image_url} size="lg" />
        <div className="detail-hero-main">
          <h2>{account.full_name}</h2>
          <p>{account.email}{account.primary_role ? ` · ${account.primary_role}` : ""}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <StatusBadge status={account.is_active ? "active" : "inactive"}>
              {account.is_active ? "Active" : "Inactive"}
            </StatusBadge>
            {isSelf ? <Badge tone="indigo">You</Badge> : null}
            {account.is_locked ? <Badge tone="red" dot>Locked</Badge> : null}
            {account.must_change_password ? <Badge tone="amber" dot>Temporary password</Badge> : null}
            {account.is_superuser ? <Badge tone="violet">Superuser</Badge> : null}
            <RoleBadges roles={account.roles} />
          </div>
        </div>
        <div className="detail-hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => setEditOpen(true)}>
            <Pencil size={15} /> Edit account
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={Clock}
          label="Last sign-in"
          value={account.last_login ? relativeTime(account.last_login) : "Never"}
          hint={account.last_login ? formatDateTime(account.last_login) : "no activity yet"}
          tone="cyan"
        />
        <StatCard icon={CalendarDays} label="Created" value={formatDate(account.created_at)} hint="account opened" tone="indigo" />
        <StatCard
          icon={ShieldCheck}
          label="Failed attempts"
          value={account.failed_login_attempts ?? 0}
          hint="since the last success"
          tone={account.failed_login_attempts ? "rose" : "emerald"}
        />
        <StatCard
          icon={KeyRound}
          label="Roles"
          value={account.roles?.length || 0}
          hint={account.primary_role || "no role"}
          tone="violet"
        />
      </div>

      <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

      <div className="detail-grid detail-block">
        <Card title="Personal details" subtitle="Contact information on this account">
          <dl className="kv">
            <dt>First name</dt><dd>{account.first_name || "—"}</dd>
            <dt>Last name</dt><dd>{account.last_name || "—"}</dd>
            <dt>Email</dt><dd>{account.email}</dd>
            <dt>Phone</dt><dd>{account.phone_number || "—"}</dd>
            <dt>Date of birth</dt><dd>{account.date_of_birth ? formatDate(account.date_of_birth) : "—"}</dd>
            <dt>Address</dt><dd>{[account.address, account.city, account.state, account.country].filter(Boolean).join(", ") || "—"}</dd>
          </dl>
        </Card>

        <Card title="Access & security" subtitle="Roles and sign-in protection">
          <dl className="kv">
            <dt>Roles</dt><dd><RoleBadges roles={account.roles} /></dd>
            <dt>Status</dt><dd><StatusBadge status={account.is_active ? "active" : "inactive"} /></dd>
            <dt>Locked</dt><dd>{account.is_locked ? `Yes${account.locked_until ? ` until ${formatDateTime(account.locked_until)}` : ""}` : "No"}</dd>
            <dt>Password</dt><dd>{account.must_change_password ? "Temporary — must change at next sign-in" : "Set by the user"}</dd>
            <dt>Last sign-in</dt><dd>{account.last_login ? formatDateTime(account.last_login) : "Never"}</dd>
          </dl>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPasswordOpen(true)}>
              <KeyRound size={14} /> Set new password
            </button>
            {account.is_locked ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={unlock} disabled={busy}>
                <Unlock size={14} /> Unlock account
              </button>
            ) : null}
          </div>
        </Card>
      </div>

      <Card
        title="Sign-in activity"
        subtitle="Successful, failed and signed-out sessions"
        className="detail-block"
      >
        <LoginHistoryTable accountUuid={account.uuid} />
      </Card>

      <Card title="Account lifecycle" subtitle="Deactivation keeps the audit trail; deletion detaches the account from active roles">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{account.is_active ? "Deactivate this account" : "Reactivate this account"}</div>
            <p className="help" style={{ marginTop: 3 }}>
              {account.is_active
                ? "The user will be signed out and cannot sign in until the account is reactivated."
                : "Restore sign-in access for this user."}
              {isSelf ? " You cannot change your own account status." : ""}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={toggleActive} disabled={busy || isSelf}>
            {account.is_active ? <Ban size={15} /> : <CheckCircle2 size={15} />}
            {account.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
        <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "16px 0" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Delete this account</div>
            <p className="help" style={{ marginTop: 3 }}>
              The account is deactivated and detached from active roles. Historical records stay for audit.
              {isSelf ? " You cannot delete your own account." : ""}
            </p>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)} disabled={busy || isSelf}>
            <Trash2 size={15} /> Delete account
          </button>
        </div>
      </Card>

      <UserFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        account={account}
        roleOptions={roleOptions}
        currentUser={currentUser}
        onSaved={() => {
          setEditOpen(false);
          toast.success("Account updated.");
          state.reload();
        }}
      />

      <SetPasswordModal
        account={passwordOpen ? account : null}
        onClose={() => setPasswordOpen(false)}
        onSaved={() => {
          setPasswordOpen(false);
          toast.success("Password reset. The user must change it at next sign-in.");
          state.reload();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        busy={busy}
        title="Delete this account?"
        message={`${account.full_name} will be deactivated and detached from active roles. Historical records are kept for audit.`}
        confirmLabel="Delete account"
      />
    </>
  );
}
