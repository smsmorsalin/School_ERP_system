import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { useAll } from "../lib/hooks";
import {
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
  Spinner,
  Toggle,
} from "../components/ui";

const CATEGORY_LABELS = {
  user_management: "User management",
  academic: "Academics",
  attendance: "Attendance",
  exams: "Examinations",
  finance: "Finance",
  communication: "Communication",
  general: "General",
};

const CATEGORY_ORDER = [
  "user_management",
  "academic",
  "attendance",
  "exams",
  "finance",
  "communication",
  "general",
];

function categoryLabel(category) {
  return (
    CATEGORY_LABELS[category] ||
    String(category || "general")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function actionLabel(code) {
  const [action, ...rest] = String(code).split("_");
  const verb = action.charAt(0).toUpperCase() + action.slice(1);
  return `${verb} ${rest.join(" ")}`;
}

export default function Roles() {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const roles = useAll("/accounts/roles/", { ordering: "name" });
  const permissions = useAll("/accounts/permissions/", { ordering: "category,code" });

  const groupedPermissions = useMemo(() => {
    const groups = new Map();
    permissions.data.forEach((permission) => {
      const key = permission.category || "general";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(permission);
    });
    return [...groups.entries()].sort(([a], [b]) => {
      const left = CATEGORY_ORDER.indexOf(a);
      const right = CATEGORY_ORDER.indexOf(b);
      return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    });
  }, [permissions.data]);

  const remove = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/accounts/roles/${deleting.uuid}/`);
      toast.success(`Role “${deleting.name}” deleted.`);
      setDeleting(null);
      roles.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const totalPermissions = permissions.data.length;

  return (
    <>
      <PageHeader
        title="Roles & access"
        subtitle="Control what each group of people can see and do"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> New role
          </button>
        }
      />

      <div className="notice info" style={{ marginBottom: 18 }}>
        <ShieldCheck />
        <div>
          Built-in roles keep the default access model and cannot be deleted. You can still
          fine-tune their permissions here — every API call is enforced on the server.
        </div>
      </div>

      {roles.loading || permissions.loading ? (
        <Loading label="Loading roles…" />
      ) : roles.data.length ? (
        <div className="grid-3">
          {roles.data.map((role) => {
            const permissionCount = role.permissions?.length || 0;
            return (
              <Card key={role.uuid} className="role-card">
                <div className="role-card-head">
                  <span className="role-icon">
                    {role.name === "Admin" ? <ShieldCheck size={18} /> : <UserCog size={18} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 15 }}>{role.name}</h3>
                      {role.is_system_role ? <Badge tone="violet">Built-in</Badge> : null}
                      {!role.is_active ? <Badge tone="neutral">Inactive</Badge> : null}
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                      {role.description || "No description yet."}
                    </p>
                  </div>
                </div>

                <div className="role-stats">
                  <span>
                    <Users size={14} /> {role.user_count || 0} user{role.user_count === 1 ? "" : "s"}
                  </span>
                  <span>
                    <KeyRound size={14} /> {permissionCount} of {totalPermissions} permissions
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setEditing(role);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={14} /> Manage access
                  </button>
                  {!role.is_system_role ? (
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Delete role"
                      onClick={() => setDeleting(role)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="No roles configured"
          description="Create a role to group permissions for your staff."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> New role
            </button>
          }
        />
      )}

      <Card
        title="Permission catalogue"
        subtitle="Every permission available in the system, grouped by area"
        className="mt-2"
      >
        {permissions.loading ? (
          <Loading label="Loading permissions…" />
        ) : groupedPermissions.length ? (
          <div className="perm-catalogue">
            {groupedPermissions.map(([category, items]) => (
              <div key={category}>
                <h4>{categoryLabel(category)}</h4>
                <div className="perm-chips">
                  {items.map((permission) => (
                    <span className="perm-chip" key={permission.uuid} title={permission.description || permission.name}>
                      <Lock size={11} />
                      {permission.code}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={KeyRound} title="No permissions registered" />
        )}
      </Card>

      <RoleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        role={editing}
        groupedPermissions={groupedPermissions}
        allPermissions={permissions.data}
        onSaved={(message) => {
          setFormOpen(false);
          toast.success(message);
          roles.reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={deleteBusy}
        title="Delete this role?"
        message={`“${deleting?.name || "This role"}” will be permanently removed. Roles assigned to users cannot be deleted.`}
        confirmLabel="Delete role"
      />
    </>
  );
}

function RoleFormModal({ open, onClose, role, groupedPermissions, allPermissions, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", description: "", is_active: true });
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const mode = role ? "edit" : "create";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSearch("");
    if (!role) {
      setForm({ name: "", description: "", is_active: true });
      setSelected([]);
      return;
    }
    setForm({
      name: role.name || "",
      description: role.description || "",
      is_active: role.is_active ?? true,
    });
    setSelected((role.permissions || []).map((permission) => permission.code));
  }, [open, role]);

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groupedPermissions;
    return groupedPermissions
      .map(([category, items]) => [
        category,
        items.filter(
          (permission) =>
            permission.code.toLowerCase().includes(needle) ||
            permission.name.toLowerCase().includes(needle)
        ),
      ])
      .filter(([, items]) => items.length);
  }, [groupedPermissions, search]);

  const toggle = (code, checked) => {
    setSelected((current) =>
      checked ? [...new Set([...current, code])] : current.filter((item) => item !== code)
    );
  };

  const toggleGroup = (items, checked) => {
    const codes = items.map((item) => item.code);
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...codes])]
        : current.filter((code) => !codes.includes(code))
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Give the role a name.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        is_active: form.is_active,
        permission_codes: selected,
      };
      if (mode === "edit") {
        await api.patch(`/accounts/roles/${role.uuid}/`, payload);
        onSaved("Role updated.");
      } else {
        await api.post("/accounts/roles/", payload);
        onSaved("Role created.");
      }
    } catch (err) {
      setError(err);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = selected.length;
  const allSelected = allPermissions.length > 0 && selectedCount === allPermissions.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? `Manage “${role?.name}”` : "Create a role"}
      subtitle={
        mode === "edit"
          ? "Adjust the role profile and tick the permissions it should grant."
          : "Group the permissions a new type of staff member needs."
      }
      size="modal-lg"
      footer={
        <>
          <span className="modal-foot-meta">
            {selectedCount} of {allPermissions.length} permissions selected
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="role-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={16} light /> : <ShieldCheck size={16} />}
            {busy ? "Saving…" : mode === "edit" ? "Save role" : "Create role"}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="role-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="Role name" required>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              disabled={role?.is_system_role}
              required
            />
            {role?.is_system_role ? (
              <div className="help">Built-in role names cannot be changed.</div>
            ) : null}
          </Field>
          <Field label="Status">
            <div style={{ paddingTop: 8 }}>
              <Toggle
                checked={form.is_active}
                onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
                label={form.is_active ? "Active" : "Inactive"}
              />
            </div>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="What is this role responsible for?"
          />
        </Field>

        <div className="perm-head">
          <div>
            <strong>Permissions</strong>
            <span className="cell-sub">Tick everything this role may do.</span>
          </div>
          <div className="input-wrap" style={{ position: "relative", width: 230 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
              }}
            />
            <input
              className="input"
              style={{ paddingLeft: 32, height: 34 }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter permissions…"
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 12px" }}>
          <Checkbox
            checked={allSelected}
            onChange={(checked) => setSelected(checked ? allPermissions.map((item) => item.code) : [])}
            label={allSelected ? "Clear all" : "Select all"}
          />
        </div>

        {filteredGroups.length ? (
          <div className="perm-groups">
            {filteredGroups.map(([category, items]) => {
              const groupCodes = items.map((item) => item.code);
              const groupChecked = groupCodes.every((code) => selected.includes(code));
              const groupPartial = !groupChecked && groupCodes.some((code) => selected.includes(code));
              return (
                <div className="perm-group" key={category}>
                  <div className="perm-group-head">
                    <Checkbox
                      checked={groupChecked}
                      onChange={(checked) => toggleGroup(items, checked)}
                      label={categoryLabel(category)}
                    />
                    {groupPartial ? <Badge tone="amber">Partial</Badge> : null}
                  </div>
                  <div className="perm-group-items">
                    {items.map((permission) => (
                      <Checkbox
                        key={permission.uuid}
                        checked={selected.includes(permission.code)}
                        onChange={(checked) => toggle(permission.code, checked)}
                        label={
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span>{permission.name || actionLabel(permission.code)}</span>
                            <code className="perm-code">{permission.code}</code>
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={KeyRound}
            title="No permissions match"
            description="Try a different filter term."
          />
        )}
      </form>
    </Modal>
  );
}
