import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  KeyRound,
  Lock,
  Pencil,
  Search,
  ShieldCheck,
  Unlock,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { ROLES } from "../lib/constants";
import { downloadCSV, formatDateTime, relativeTime } from "../lib/format";
import { useAll, useDebounced, useList } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  RoleBadges,
  SearchInput,
  Spinner,
  StatusBadge,
  Toggle,
} from "../components/ui";

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  roles: [],
  password: "",
  is_active: true,
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [historyUser, setHistoryUser] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [rowBusy, setRowBusy] = useState(null);

  const list = useList("/accounts/users/", { ordering: "-created_at" });
  const { data: roles } = useAll("/accounts/roles/", { ordering: "name" });

  const roleOptions = useMemo(() => {
    const names = roles.filter((role) => role.is_active !== false).map((role) => role.name);
    return names.length ? names : ROLES;
  }, [roles]);

  useEffect(() => {
    list.update({
      search: debounced,
      role: roleFilter,
      is_active: statusFilter,
      page: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, roleFilter, statusFilter]);

  const toggleActive = async (account) => {
    setRowBusy(account.uuid);
    try {
      const response = await api.post(`/accounts/users/${account.uuid}/toggle-active/`, {});
      toast.success(response?.detail || "Account status updated.");
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRowBusy(null);
    }
  };

  const unlock = async (account) => {
    setRowBusy(account.uuid);
    try {
      const response = await api.post(`/accounts/users/${account.uuid}/unlock/`, {});
      toast.success(response?.detail || "Account unlocked.");
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRowBusy(null);
    }
  };

  const remove = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/accounts/users/${deleting.uuid}/`);
      toast.success("Account deactivated and detached from active roles.");
      setDeleting(null);
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const exportRows = () => {
    downloadCSV(
      "user-accounts.csv",
      list.rows.map((account) => [
        account.full_name,
        account.email,
        account.phone_number || "",
        (account.roles || []).join("; "),
        account.is_active ? "Active" : "Inactive",
        account.last_login || "",
        account.created_at || "",
      ]),
      ["Name", "Email", "Phone", "Roles", "Status", "Last sign-in", "Created"]
    );
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    const ok = await copyText(
      `Email: ${credentials.email}\nTemporary password: ${credentials.temporary_password}`
    );
    if (ok) toast.success("Sign-in details copied to the clipboard.");
    else toast.error("Copy failed. Please select the text manually.");
  };

  return (
    <>
      <PageHeader
        title="User accounts"
        subtitle={`${list.count} account${list.count === 1 ? "" : "s"} across every role`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportRows}
              disabled={!list.rows.length}
            >
              <Download size={16} /> Export
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <UserPlus size={16} /> Add user
            </button>
          </>
        }
      />

      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, email or phone…"
          />
          <select
            className="select"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {roleOptions.map((role) => (
              <option value={role} key={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {search || roleFilter || statusFilter ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                setStatusFilter("");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {list.loading ? (
          <Loading />
        ) : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Last sign-in</th>
                    <th>Created</th>
                    <th className="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((account) => {
                    const isSelf = account.uuid === currentUser?.uuid;
                    const busy = rowBusy === account.uuid;
                    return (
                      <tr key={account.uuid}>
                        <td>
                          <div className="cell-user">
                            <Avatar
                              name={account.full_name}
                              src={account.profile_image_url}
                              size="sm"
                            />
                            <div>
                              <div className="cell-main">
                                {account.full_name}
                                {isSelf ? (
                                  <Badge tone="indigo" className="ml-1">
                                    You
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="cell-sub">{account.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <RoleBadges roles={account.roles} />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <StatusBadge status={account.is_active ? "active" : "inactive"}>
                              {account.is_active ? "Active" : "Inactive"}
                            </StatusBadge>
                            {account.is_locked ? (
                              <Badge tone="red" dot>
                                Locked
                              </Badge>
                            ) : null}
                            {account.must_change_password ? (
                              <Badge tone="amber" dot>
                                Temp password
                              </Badge>
                            ) : null}
                            {account.is_superuser ? (
                              <Badge tone="violet">Superuser</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div>{account.last_login ? relativeTime(account.last_login) : "Never"}</div>
                          <div className="cell-sub">
                            {account.last_login ? formatDateTime(account.last_login) : "—"}
                          </div>
                        </td>
                        <td className="cell-sub">{formatDateTime(account.created_at)}</td>
                        <td className="actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit account"
                            onClick={() => {
                              setEditing(account);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Set a new password"
                            onClick={() => setPasswordUser(account)}
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="View sign-in history"
                            onClick={() => setHistoryUser(account)}
                          >
                            <Clock size={15} />
                          </button>
                          {account.is_locked ? (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Unlock account"
                              onClick={() => unlock(account)}
                              disabled={busy}
                            >
                              <Unlock size={15} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="icon-btn"
                            title={account.is_active ? "Deactivate account" : "Activate account"}
                            onClick={() => toggleActive(account)}
                            disabled={busy || isSelf}
                          >
                            {busy ? (
                              <Spinner size={14} />
                            ) : account.is_active ? (
                              <Ban size={15} />
                            ) : (
                              <CheckCircle2 size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            title="Delete account"
                            onClick={() => setDeleting(account)}
                            disabled={isSelf}
                          >
                            <Lock size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              count={list.count}
              onPage={list.setPage}
              label="accounts"
            />
          </>
        ) : (
          <EmptyState
            icon={UsersIcon}
            title="No accounts found"
            description={
              search || roleFilter || statusFilter
                ? "Try changing or clearing the filters."
                : "Create the first staff or student account."
            }
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <UserPlus size={16} /> Add user
              </button>
            }
          />
        )}
      </Card>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        account={editing}
        roleOptions={roleOptions}
        currentUser={currentUser}
        onSaved={(result) => {
          setFormOpen(false);
          if (result?.temporary_password) setCredentials(result);
          else toast.success(editing ? "Account updated." : "Account created.");
          list.reload();
        }}
      />

      <SetPasswordModal
        account={passwordUser}
        onClose={() => setPasswordUser(null)}
        onSaved={() => {
          setPasswordUser(null);
          toast.success("Password reset. The user must change it at next sign-in.");
          list.reload();
        }}
      />

      <LoginHistoryModal account={historyUser} onClose={() => setHistoryUser(null)} />

      <Modal
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="Account created"
        subtitle="Share these sign-in details securely."
        size="modal-sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={copyCredentials}>
              <Copy size={15} /> Copy details
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCredentials(null)}>
              Done
            </button>
          </>
        }
      >
        <div className="notice success" style={{ marginBottom: 14 }}>
          The user must choose a new password at first sign-in.
        </div>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{credentials?.full_name}</dd>
          <dt>Email</dt>
          <dd>{credentials?.email}</dd>
          <dt>Temporary password</dt>
          <dd>
            <code style={{ fontSize: 13 }}>{credentials?.temporary_password}</code>
          </dd>
          <dt>Roles</dt>
          <dd>{(credentials?.roles || []).join(", ") || "—"}</dd>
        </dl>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={deleteBusy}
        title="Delete this account?"
        message={`${deleting?.full_name || "This user"} will be deactivated and removed from all active roles. Their records stay intact for audit purposes.`}
        confirmLabel="Delete account"
      />
    </>
  );
}

function generatePassword() {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = lower + upper + digits + symbols;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
}

function UserFormModal({ open, onClose, account, roleOptions, currentUser, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const mode = account ? "edit" : "create";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowPassword(false);
    if (!account) {
      setForm(emptyForm);
      return;
    }
    setForm({
      first_name: account.first_name || "",
      last_name: account.last_name || "",
      email: account.email || "",
      phone_number: account.phone_number || "",
      roles: account.roles || [],
      password: "",
      is_active: account.is_active ?? true,
    });
  }, [open, account]);

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleRole = (role, checked) => {
    setForm((current) => ({
      ...current,
      roles: checked
        ? [...current.roles, role]
        : current.roles.filter((item) => item !== role),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!form.roles.length) {
      setError("Select at least one role for this account.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        roles: form.roles,
      };
      let result;
      if (mode === "edit") {
        payload.is_active = form.is_active;
        result = await api.patch(`/accounts/users/${account.uuid}/`, payload);
      } else {
        if (form.password) payload.password = form.password;
        result = await api.post("/accounts/users/", payload);
      }
      onSaved(result);
    } catch (err) {
      setError(err);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit account" : "Add a user account"}
      subtitle={
        mode === "edit"
          ? "Update personal details, roles and access."
          : "A temporary password is generated automatically unless you set one."
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={16} light /> : <UserPlus size={16} />}
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create account"}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="user-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="First name" required>
            <input className="input" value={form.first_name} onChange={set("first_name")} required />
          </Field>
          <Field label="Last name" required>
            <input className="input" value={form.last_name} onChange={set("last_name")} required />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Email address" required>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Phone number">
            <input
              className="input"
              value={form.phone_number}
              onChange={set("phone_number")}
              autoComplete="tel"
            />
          </Field>
        </div>

        <Field label="Roles" required hint="A user can hold more than one role.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", paddingTop: 4 }}>
            {roleOptions.map((role) => (
              <Checkbox
                key={role}
                label={role}
                checked={form.roles.includes(role)}
                disabled={role === "Admin" && !currentUser?.is_superuser}
                onChange={(checked) => toggleRole(role, checked)}
              />
            ))}
          </div>
          {!currentUser?.is_superuser ? (
            <div className="help">Only a superuser can grant the Admin role.</div>
          ) : null}
        </Field>

        {mode === "create" ? (
          <Field
            label="Initial password"
            hint="Leave blank to generate a secure temporary password automatically."
          >
            <div className="input-wrap">
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
                placeholder="Generated automatically"
              />
              <button
                type="button"
                className="icon-btn trail"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <ShieldCheck size={16} />
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => {
                setForm((current) => ({ ...current, password: generatePassword() }));
                setShowPassword(true);
              }}
            >
              <KeyRound size={14} /> Generate password
            </button>
          </Field>
        ) : (
          <Toggle
            checked={form.is_active}
            onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
            label="Account active"
          />
        )}
      </form>
    </Modal>
  );
}

function SetPasswordModal({ account, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ new_password: "", new_password_confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    setForm({ new_password: "", new_password_confirm: "" });
    setError(null);
    setShow(false);
  }, [account]);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (form.new_password !== form.new_password_confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/accounts/users/${account.uuid}/set-password/`, form);
      onSaved();
    } catch (err) {
      setError(err);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      title="Set a new password"
      subtitle={account ? `${account.full_name} · ${account.email}` : ""}
      size="modal-sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="set-password-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={16} light /> : <KeyRound size={16} />}
            {busy ? "Saving…" : "Set password"}
          </button>
        </>
      }
    >
      <div className="notice warning" style={{ marginBottom: 14 }}>
        The user will be required to choose a new password at their next sign-in.
      </div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="set-password-form" onSubmit={submit}>
        <Field label="New password" required hint="At least 8 characters with letters, numbers and symbols.">
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
              setForm((current) => ({ ...current, new_password_confirm: event.target.value }))
            }
            autoComplete="new-password"
            required
          />
        </Field>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const password = generatePassword();
            setForm({ new_password: password, new_password_confirm: password });
            setShow(true);
          }}
        >
          <KeyRound size={14} /> Generate a strong password
        </button>
      </form>
    </Modal>
  );
}

function LoginHistoryModal({ account, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    setError(null);
    api
      .get(`/accounts/users/${account.uuid}/login-history/`)
      .then((data) => setEntries(Array.isArray(data) ? data : data.results || []))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [account]);

  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      title="Sign-in history"
      subtitle={account ? `${account.full_name} · ${account.email}` : ""}
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? (
        <Loading label="Loading activity…" />
      ) : entries.length ? (
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th>Status</th>
                <th>When</th>
                <th>IP address</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.uuid}>
                  <td>
                    <StatusBadge status={entry.status}>
                      {entry.status === "success" ? "Success" : entry.status === "logout" ? "Signed out" : "Failed"}
                    </StatusBadge>
                    {entry.failure_reason ? (
                      <div className="cell-sub">{entry.failure_reason}</div>
                    ) : null}
                  </td>
                  <td>
                    <div>{formatDateTime(entry.login_time)}</div>
                    {entry.logout_time ? (
                      <div className="cell-sub">Out: {formatDateTime(entry.logout_time)}</div>
                    ) : null}
                  </td>
                  <td className="cell-sub">{entry.ip_address || "—"}</td>
                  <td className="cell-sub" style={{ textTransform: "capitalize" }}>
                    {entry.device_type || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Clock}
          title="No sign-in activity yet"
          description="Successful and failed sign-in attempts will appear here."
        />
      )}
    </Modal>
  );
}
