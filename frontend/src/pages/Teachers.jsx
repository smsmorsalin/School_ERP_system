import { useEffect, useState } from "react";
import {
  Briefcase,
  Download,
  GraduationCap,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { downloadCSV, formatDate, todayISO } from "../lib/format";
import { EMPLOYMENT_TYPES } from "../lib/constants";
import { useDebounced, useList } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
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
  qualification: "",
  specialization: "",
  joining_date: todayISO(),
  employment_type: "full_time",
  password: "",
  is_active: true,
};

export default function Teachers() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const list = useList("/academics/teachers/", { ordering: "employee_id" });

  useEffect(() => {
    list.update({ search: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/academics/teachers/${deleting.uuid}/`);
      toast.success("Teacher archived and account deactivated.");
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
      "teachers.csv",
      list.rows.map((teacher) => [
        teacher.full_name,
        teacher.employee_id,
        teacher.email,
        teacher.qualification,
        teacher.specialization,
        teacher.employment_type,
        teacher.sections?.map((section) => section.name).join("; "),
      ]),
      ["Name", "Employee ID", "Email", "Qualification", "Specialization", "Employment", "Sections"]
    );
  };

  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle={`${list.count} teaching staff member${list.count === 1 ? "" : "s"}`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}>
              <Download size={16} /> Export
            </button>
            <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <UserPlus size={16} /> Add teacher
            </button>
          </>
        }
      />

      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or specialization…" />
          {search ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch("")}>Clear</button>
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
                    <th>Teacher</th>
                    <th>Employee ID</th>
                    <th>Qualification</th>
                    <th>Sections</th>
                    <th>Employment</th>
                    <th>Joined</th>
                    <th className="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((teacher) => (
                    <tr key={teacher.uuid}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={teacher.full_name} size="sm" />
                          <div>
                            <div className="cell-main">{teacher.full_name}</div>
                            <div className="cell-sub">{teacher.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone="neutral">{teacher.employee_id}</Badge></td>
                      <td>
                        <div>{teacher.qualification || "—"}</div>
                        <div className="cell-sub">{teacher.specialization || "General"}</div>
                      </td>
                      <td>
                        {teacher.sections?.length ? (
                          <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                            {teacher.sections.slice(0, 3).map((section) => (
                              <Badge tone="indigo" key={section.uuid}>{section.name}</Badge>
                            ))}
                            {teacher.sections.length > 3 ? <Badge tone="neutral">+{teacher.sections.length - 3}</Badge> : null}
                          </span>
                        ) : (
                          <span className="cell-sub">No sections</span>
                        )}
                      </td>
                      <td><Badge tone="neutral">{teacher.employment_type?.replace("_", " ")}</Badge></td>
                      <td className="cell-sub">{formatDate(teacher.joining_date)}</td>
                      <td className="actions">
                        <button type="button" className="icon-btn" title="Edit" onClick={() => { setEditing(teacher); setFormOpen(true); }}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="icon-btn danger" title="Archive" onClick={() => setDeleting(teacher)}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="teachers" />
          </>
        ) : (
          <EmptyState
            icon={Users}
            title="No teachers found"
            description={search ? "Try a different search term." : "Add your first teaching staff member."}
            action={
              <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus size={16} /> Add teacher
              </button>
            }
          />
        )}
      </Card>

      <TeacherFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        teacher={editing}
        onSaved={(result) => {
          setFormOpen(false);
          if (result?.temporary_password) setCredentials(result);
          else toast.success(editing ? "Teacher updated." : "Teacher added.");
          list.reload();
        }}
      />

      <Modal
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="Teacher account created"
        subtitle="Share these sign-in details securely."
        size="modal-sm"
        footer={<button type="button" className="btn btn-primary" onClick={() => setCredentials(null)}>Done</button>}
      >
        <div className="notice success" style={{ marginBottom: 14 }}>
          The teacher must change this temporary password at first sign-in.
        </div>
        <dl className="kv">
          <dt>Email</dt><dd>{credentials?.email}</dd>
          <dt>Temporary password</dt><dd><code style={{ fontSize: 13 }}>{credentials?.temporary_password}</code></dd>
          <dt>Employee ID</dt><dd>{credentials?.employee_id}</dd>
        </dl>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        busy={deleteBusy}
        title="Archive this teacher?"
        message={`${deleting?.full_name || "This teacher"} will be removed from active staff and their account deactivated.`}
        confirmLabel="Archive teacher"
      />
    </>
  );
}

function TeacherFormModal({ open, onClose, teacher, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const mode = teacher ? "edit" : "create";

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!teacher) {
      setForm(emptyForm);
      return;
    }
    const [first, ...rest] = (teacher.full_name || "").split(" ");
    setForm({
      ...emptyForm,
      first_name: first || "",
      last_name: rest.join(" "),
      email: teacher.email || "",
      qualification: teacher.qualification || "",
      specialization: teacher.specialization || "",
      joining_date: teacher.joining_date || "",
      employment_type: teacher.employment_type || "full_time",
      is_active: teacher.is_active ?? true,
    });
    api.get(`/accounts/users/${teacher.user.uuid}/`).then((user) => {
      setForm((current) => ({ ...current, phone_number: user.phone_number || "" }));
    }).catch(() => {});
  }, [open, teacher]);

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = { ...form, joining_date: form.joining_date || null, phone_number: form.phone_number || "" };
      if (!payload.password) delete payload.password;
      if (mode === "create") delete payload.is_active;
      const result = mode === "edit"
        ? await api.patch(`/academics/teachers/${teacher.uuid}/`, payload)
        : await api.post("/academics/teachers/", payload);
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
      title={mode === "edit" ? "Edit teacher" : "Add a teacher"}
      subtitle={mode === "edit" ? "Update staff details." : "A teacher account is created automatically."}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="teacher-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={16} light /> : <GraduationCap size={16} />}
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add teacher"}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="teacher-form" onSubmit={submit}>
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
            <input className="input" type="email" value={form.email} onChange={set("email")} required />
          </Field>
          <Field label="Phone number">
            <input className="input" value={form.phone_number} onChange={set("phone_number")} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Qualification">
            <input className="input" value={form.qualification} onChange={set("qualification")} placeholder="e.g. M.Ed" />
          </Field>
          <Field label="Specialization">
            <input className="input" value={form.specialization} onChange={set("specialization")} placeholder="e.g. Mathematics" />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Joining date">
            <input className="input" type="date" value={form.joining_date} onChange={set("joining_date")} />
          </Field>
          <Field label="Employment type">
            <select className="select" value={form.employment_type} onChange={set("employment_type")}>
              {EMPLOYMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
        </div>
        {mode === "create" ? (
          <Field label="Initial password" hint="Leave blank to generate a secure temporary password.">
            <input className="input" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
        ) : (
          <Toggle checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label="Account active" />
        )}
      </form>
    </Modal>
  );
}
