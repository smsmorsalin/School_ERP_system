import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Download,
  Droplets,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { downloadCSV, formatDate, fullName, percent, todayISO } from "../lib/format";
import { GENDERS, RELATIONS, STUDENT_STATUSES } from "../lib/constants";
import {
  useAll,
  useDebounced,
  useFetch,
  useList,
  useReferenceData,
} from "../lib/hooks";
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
  date_of_birth: "",
  gender: "",
  blood_group: "",
  admission_date: todayISO(),
  current_section: "",
  roll_number: "",
  password: "",
  address: "",
  city: "",
  country: "",
  status: "active",
  is_active: true,
};

function cleanPayload(form, mode) {
  const payload = {
    ...form,
    current_section: form.current_section || null,
    roll_number: form.roll_number === "" ? null : Number(form.roll_number),
    date_of_birth: form.date_of_birth || null,
    admission_date: form.admission_date || null,
    gender: form.gender || "",
    blood_group: form.blood_group || "",
    phone_number: form.phone_number || "",
  };
  if (!payload.password) delete payload.password;
  if (mode === "edit") {
    delete payload.password;
    delete payload.address;
    delete payload.city;
    delete payload.country;
  } else {
    delete payload.status;
    delete payload.is_active;
  }
  return payload;
}

export default function Students() {
  const { isAdmin, hasRole } = useAuth();
  if (hasRole("Student") && !isAdmin) return <StudentSelfView />;
  if (hasRole("Parent") && !isAdmin && !hasRole("Teacher", "Accountant")) return <ParentChildrenView />;
  return <StaffStudentsView />;
}

/* ------------------------------------------------------------------ staff */
function StaffStudentsView() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("");
  const [detail, setDetail] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const { sections } = useReferenceData({ sections: true });

  const list = useList("/academics/students/", {}, { pageSize: 20 });

  useEffect(() => {
    list.update({ search: debouncedSearch, status, section, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, section]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && isAdmin) {
      setEditing(null);
      setFormOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
    const uuid = searchParams.get("student");
    if (uuid) {
      api
        .get(`/academics/students/${uuid}/`)
        .then(setDetail)
        .catch((error) => toast.error(error.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (student) => {
    try {
      setDetail(await api.get(`/academics/students/${student.uuid}/`));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/academics/students/${deleting.uuid}/`);
      toast.success("Student archived and account deactivated.");
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
      "students.csv",
      list.rows.map((student) => [
        student.user?.full_name,
        student.student_id,
        student.class_name,
        student.section_name,
        student.roll_number,
        student.status,
        student.user?.email,
      ]),
      ["Name", "Student ID", "Class", "Section", "Roll", "Status", "Email"]
    );
  };

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${list.count} student${list.count === 1 ? "" : "s"} in the directory`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}>
              <Download size={16} /> Export
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <UserPlus size={16} /> Admit student
              </button>
            ) : null}
          </>
        }
      />

      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, ID or email…" />
          <select className="select" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {sections.map((item) => (
              <option key={item.uuid} value={item.uuid}>{item.display_name}</option>
            ))}
          </select>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STUDENT_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          {(search || status || section) ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch("");
                setStatus("");
                setSection("");
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
                    <th>Student</th>
                    <th>Class / section</th>
                    <th>Roll</th>
                    <th>Guardian contact</th>
                    <th>Status</th>
                    <th className="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((student) => (
                    <tr key={student.uuid}>
                      <td>
                        <button
                          type="button"
                          onClick={() => openDetail(student)}
                          className="cell-user"
                          style={{ border: 0, background: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                        >
                          <Avatar name={student.user?.full_name} src={student.user?.profile_image_url} size="sm" />
                          <span>
                            <span className="cell-main" style={{ display: "block" }}>{student.user?.full_name}</span>
                            <span className="cell-sub">{student.student_id} · {student.user?.email}</span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <div>{student.class_name || "—"}</div>
                        <div className="cell-sub">{student.section_name || "Unassigned"}</div>
                      </td>
                      <td>{student.roll_number ?? "—"}</td>
                      <td>
                        {student.guardians?.length ? (
                          <>
                            <div>{student.guardians[0].full_name}</div>
                            <div className="cell-sub">{student.guardians[0].phone_number || student.guardians[0].email}</div>
                          </>
                        ) : (
                          <span className="cell-sub">Not linked</span>
                        )}
                      </td>
                      <td><StatusBadge status={student.status} /></td>
                      <td className="actions" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="icon-btn" title="View" onClick={() => openDetail(student)}>
                          <Users size={15} />
                        </button>
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit"
                              onClick={() => {
                                setEditing(student);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button type="button" className="icon-btn danger" title="Archive" onClick={() => setDeleting(student)}>
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              count={list.count}
              onPage={list.setPage}
              label="students"
            />
          </>
        ) : (
          <EmptyState
            icon={Users}
            title="No students found"
            description={search || status || section ? "Try adjusting your filters." : "Admit your first student to get started."}
            action={
              isAdmin ? (
                <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus size={16} /> Admit student
                </button>
              ) : null
            }
          />
        )}
      </Card>

      <StudentDetailModal
        student={detail}
        onClose={() => {
          setDetail(null);
          if (searchParams.get("student")) {
            searchParams.delete("student");
            setSearchParams(searchParams, { replace: true });
          }
        }}
        canManage={isAdmin}
        sections={sections}
        onEdit={(student) => {
          setDetail(null);
          setEditing(student);
          setFormOpen(true);
        }}
      />

      <StudentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editing}
        sections={sections}
        onSaved={(payload) => {
          setFormOpen(false);
          if (payload?.temporary_password) setCreatedCredentials(payload);
          else toast.success(editing ? "Student details updated." : "Student admitted successfully.");
          if (detail) setDetail(null);
          list.reload();
        }}
      />

      <Modal
        open={Boolean(createdCredentials)}
        onClose={() => setCreatedCredentials(null)}
        title="Student admitted"
        subtitle="Share these sign-in details with the family."
        size="modal-sm"
        footer={<button type="button" className="btn btn-primary" onClick={() => setCreatedCredentials(null)}>Done</button>}
      >
        <div className="notice success" style={{ marginBottom: 14 }}>
          The student account is ready. They will be asked to change this temporary password at first sign-in.
        </div>
        <dl className="kv">
          <dt>Email</dt><dd>{createdCredentials?.user?.email}</dd>
          <dt>Temporary password</dt><dd><code style={{ fontSize: 13 }}>{createdCredentials?.temporary_password}</code></dd>
          <dt>Student ID</dt><dd>{createdCredentials?.student_id}</dd>
        </dl>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        busy={deleteBusy}
        title="Archive this student?"
        message={`${deleting?.user?.full_name || "This student"} will be marked as transferred and their account deactivated. Records are kept for audit.`}
        confirmLabel="Archive student"
      />
    </>
  );
}

/* ------------------------------------------------------------------ detail */
function StudentDetailModal({ student, onClose, canManage, onEdit, sections }) {
  const toast = useToast();
  const [userDetail, setUserDetail] = useState(null);
  const [parents, setParents] = useState([]);
  const [guardianForm, setGuardianForm] = useState({ user: "", relation: "guardian", is_primary: false });
  const [guardianBusy, setGuardianBusy] = useState(false);
  const [localStudent, setLocalStudent] = useState(student);

  useEffect(() => {
    setLocalStudent(student);
  }, [student]);

  useEffect(() => {
    if (!student?.user?.uuid) return;
    if (canManage) {
      api.get(`/accounts/users/${student.user.uuid}/`).then(setUserDetail).catch(() => {});
      useAllParents(setParents);
    }
  }, [student?.user?.uuid, canManage]);

  if (!localStudent) return null;

  const addGuardian = async () => {
    if (!guardianForm.user) return;
    setGuardianBusy(true);
    try {
      await api.post(`/academics/students/${localStudent.uuid}/guardians/`, guardianForm);
      toast.success("Guardian linked to the student.");
      const updated = await api.get(`/academics/students/${localStudent.uuid}/`);
      setLocalStudent(updated);
      setGuardianForm({ user: "", relation: "guardian", is_primary: false });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGuardianBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(localStudent)}
      onClose={onClose}
      title="Student profile"
      subtitle={`${localStudent.student_id} · ${localStudent.class_name || "No class"}`}
      size="modal-lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          {canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => onEdit(localStudent)}>
              <Pencil size={15} /> Edit details
            </button>
          ) : null}
        </>
      }
    >
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <Avatar name={localStudent.user?.full_name} src={localStudent.user?.profile_image_url} size="lg" />
        <div style={{ flex: 1, minWidth: 180 }}>
          <h3 style={{ fontSize: 19 }}>{localStudent.user?.full_name}</h3>
          <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{localStudent.user?.email}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            <StatusBadge status={localStudent.status} />
            {localStudent.gender ? <Badge tone="neutral">{localStudent.gender}</Badge> : null}
            {localStudent.blood_group ? <Badge tone="red"><Droplets size={11} /> {localStudent.blood_group}</Badge> : null}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700 }}>Attendance</div>
          <div style={{ fontSize: 23, fontWeight: 750 }}>{localStudent.attendance_rate == null ? "—" : percent(localStudent.attendance_rate, 0)}</div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <h4 style={{ fontSize: 13, marginBottom: 10, color: "var(--text-2)" }}>Enrollment</h4>
          <dl className="kv">
            <dt>Student ID</dt><dd>{localStudent.student_id}</dd>
            <dt>Class</dt><dd>{localStudent.class_name || "—"}</dd>
            <dt>Section</dt><dd>{localStudent.section_name || "—"}</dd>
            <dt>Roll number</dt><dd>{localStudent.roll_number ?? "—"}</dd>
            <dt>Admitted</dt><dd>{formatDate(localStudent.admission_date)}</dd>
            <dt>Date of birth</dt><dd>{formatDate(userDetail?.date_of_birth)}</dd>
          </dl>
        </div>
        <div>
          <h4 style={{ fontSize: 13, marginBottom: 10, color: "var(--text-2)" }}>Contact</h4>
          <dl className="kv">
            <dt>Email</dt><dd>{localStudent.user?.email || "—"}</dd>
            <dt>Phone</dt><dd>{userDetail?.phone_number || "—"}</dd>
            <dt>City</dt><dd>{userDetail?.city || "—"}</dd>
            <dt>Country</dt><dd>{userDetail?.country || "—"}</dd>
          </dl>
        </div>
      </div>

      <div className="divider" />
      <h4 style={{ fontSize: 13, marginBottom: 10, color: "var(--text-2)" }}>Guardians</h4>
      {localStudent.guardians?.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {localStudent.guardians.map((guardian) => (
            <div key={guardian.uuid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
              <Avatar name={guardian.full_name} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {guardian.full_name} {guardian.is_primary ? <Badge tone="indigo">Primary</Badge> : null}
                </div>
                <div className="cell-sub">{guardian.relation} · {guardian.email}{guardian.phone_number ? ` · ${guardian.phone_number}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--muted)" }}>No guardian linked yet.</p>
      )}

      {canManage ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px dashed var(--border-strong)", borderRadius: 10, background: "var(--surface-2)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Link an existing parent account</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 180px" }}>
              <select className="select" value={guardianForm.user} onChange={(event) => setGuardianForm((current) => ({ ...current, user: event.target.value }))}>
                <option value="">Select parent account…</option>
                {parents.map((parent) => (
                  <option key={parent.uuid} value={parent.uuid}>{parent.full_name} ({parent.email})</option>
                ))}
              </select>
            </div>
            <div style={{ width: 130 }}>
              <select className="select" value={guardianForm.relation} onChange={(event) => setGuardianForm((current) => ({ ...current, relation: event.target.value }))}>
                {RELATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <Checkbox
              checked={guardianForm.is_primary}
              onChange={(value) => setGuardianForm((current) => ({ ...current, is_primary: value }))}
              label="Primary"
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={addGuardian} disabled={!guardianForm.user || guardianBusy}>
              {guardianBusy ? <Spinner size={14} light /> : <Plus size={14} />} Link
            </button>
          </div>
          <p className="help" style={{ marginTop: 7 }}>
            Parents must already have an account with the Parent role. Create one under User accounts first.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

function useAllParents(setParents) {
  api
    .get("/accounts/users/", { role: "Parent", page_size: 100 })
    .then((data) => setParents(data.results || []))
    .catch(() => {});
}

/* ------------------------------------------------------------------ form */
function StudentFormModal({ open, onClose, student, sections, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const mode = student ? "edit" : "create";

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!student) {
      setForm(emptyForm);
      return;
    }
    setForm({
      ...emptyForm,
      first_name: student.user?.full_name?.split(" ")[0] || "",
      last_name: student.user?.full_name?.split(" ").slice(1).join(" ") || "",
      email: student.user?.email || "",
      gender: student.gender || "",
      blood_group: student.blood_group || "",
      admission_date: student.admission_date || "",
      current_section: student.section_uuid || "",
      roll_number: student.roll_number ?? "",
      status: student.status || "active",
      is_active: student.is_active ?? true,
    });
    api
      .get(`/accounts/users/${student.user.uuid}/`)
      .then((user) => {
        setForm((current) => ({
          ...current,
          first_name: user.first_name || current.first_name,
          last_name: user.last_name || current.last_name,
          email: user.email || current.email,
          phone_number: user.phone_number || "",
          date_of_birth: user.date_of_birth || "",
        }));
      })
      .catch(() => {});
  }, [open, student]);

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = cleanPayload(form, mode);
      const result =
        mode === "edit"
          ? await api.patch(`/academics/students/${student.uuid}/`, payload)
          : await api.post("/academics/students/", payload);
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
      title={mode === "edit" ? "Edit student" : "Admit a new student"}
      subtitle={mode === "edit" ? "Update enrollment and contact details." : "A sign-in account is created automatically."}
      size="modal-lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="student-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={16} light /> : <UserCheck size={16} />}
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Admit student"}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="student-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="First name" required>
            <input className="input" value={form.first_name} onChange={set("first_name")} required maxLength={150} />
          </Field>
          <Field label="Last name" required>
            <input className="input" value={form.last_name} onChange={set("last_name")} required maxLength={150} />
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
          <Field label="Date of birth">
            <input className="input" type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
          </Field>
          <Field label="Admission date">
            <input className="input" type="date" value={form.admission_date} onChange={set("admission_date")} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Gender">
            <select className="select" value={form.gender} onChange={set("gender")}>
              <option value="">Not specified</option>
              {GENDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Blood group">
            <input className="input" value={form.blood_group} onChange={set("blood_group")} placeholder="e.g. O+" maxLength={5} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Class / section">
            <select className="select" value={form.current_section} onChange={set("current_section")}>
              <option value="">Unassigned</option>
              {sections.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
            </select>
          </Field>
          <Field label="Roll number">
            <input className="input" type="number" min="1" value={form.roll_number} onChange={set("roll_number")} />
          </Field>
        </div>

        {mode === "edit" ? (
          <div className="field-row">
            <Field label="Enrollment status">
              <select className="select" value={form.status} onChange={set("status")}>
                {STUDENT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <div className="field" style={{ paddingTop: 26 }}>
              <Toggle checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label="Account active" />
            </div>
          </div>
        ) : (
          <>
            <div className="field-row">
              <Field label="City">
                <input className="input" value={form.city} onChange={set("city")} />
              </Field>
              <Field label="Country">
                <input className="input" value={form.country} onChange={set("country")} />
              </Field>
            </div>
            <Field label="Address">
              <textarea className="textarea" value={form.address} onChange={set("address")} rows={2} />
            </Field>
            <Field label="Initial password" hint="Leave blank to generate a secure temporary password. The student must change it at first sign-in.">
              <input className="input" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ family views */
function StudentSelfView() {
  const { data, loading, error } = useFetch("/academics/students/me/");
  if (loading) return <Loading />;
  if (error) return <ErrorBanner error={error} />;
  return <FamilyStudentProfile student={data} title="My student record" />;
}

function ParentChildrenView() {
  const { data, loading, error } = useAll("/academics/students/my-children/");
  if (loading) return <Loading />;
  if (error) return <ErrorBanner error={error} />;
  return (
    <>
      <PageHeader title="My children" subtitle="Enrollment details and guardians for each child" />
      {data.length ? (
        <div className="grid-2">
          {data.map((child) => (
            <FamilyStudentProfile key={child.uuid} student={child} card />
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="No children linked" description="Contact the school office to link your account to your children." />
      )}
    </>
  );
}

function FamilyStudentProfile({ student, title, card = false }) {
  if (!student) return null;
  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <Avatar name={student.user?.full_name} src={student.user?.profile_image_url} size="lg" />
        <div>
          <h3 style={{ fontSize: 18 }}>{student.user?.full_name}</h3>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{student.student_id}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <StatusBadge status={student.status} />
            {student.section_name ? <Badge tone="indigo">{student.section_name}</Badge> : null}
          </div>
        </div>
      </div>
      <dl className="kv">
        <dt>Class</dt><dd>{student.class_name || "—"}</dd>
        <dt>Roll number</dt><dd>{student.roll_number ?? "—"}</dd>
        <dt>Admission date</dt><dd>{formatDate(student.admission_date)}</dd>
        <dt>Attendance</dt><dd>{student.attendance_rate == null ? "—" : percent(student.attendance_rate, 0)}</dd>
        <dt>Email</dt><dd>{student.user?.email}</dd>
      </dl>
      <div className="divider" />
      <h4 style={{ fontSize: 12.5, marginBottom: 8, color: "var(--text-2)" }}>Guardians</h4>
      {student.guardians?.length ? student.guardians.map((guardian) => (
        <div key={guardian.uuid} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 12.5 }}>
          <UserCheck size={14} style={{ color: "var(--muted)" }} />
          {guardian.full_name} · {guardian.relation}
          {guardian.is_primary ? <Badge tone="indigo">Primary</Badge> : null}
        </div>
      )) : <p style={{ fontSize: 12 }} className="cell-sub">No guardians linked.</p>}
    </>
  );

  if (card) return <Card>{content}</Card>;
  return (
    <>
      <PageHeader title={title} subtitle="Read-only view of the enrollment record" />
      <Card style={{ maxWidth: 720 }}>{content}</Card>
    </>
  );
}
