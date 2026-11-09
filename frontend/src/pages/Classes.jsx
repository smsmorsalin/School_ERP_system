import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  DoorOpen,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { useAll, useList, useReferenceData } from "../lib/hooks";
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
  Spinner,
  StatusBadge,
  Tabs,
  Toggle,
} from "../components/ui";

export default function Classes() {
  const { isAdmin, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "classes");
  const [classFilter, setClassFilter] = useState(searchParams.get("class") || "");
  const { classes, years, loading: refsLoading } = useReferenceData({ classes: true, years: true });
  const sectionsList = useList("/academics/sections/", {}, { pageSize: 50 });
  const classesData = useAll("/academics/classes/", { ordering: "level" });
  const canManage = isAdmin;

  useEffect(() => {
    sectionsList.update({ school_class: classFilter, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFilter]);

  useEffect(() => {
    if (searchParams.get("class")) setClassFilter(searchParams.get("class"));
    if (searchParams.get("tab")) setTab(searchParams.get("tab"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (value) => {
    setTab(value);
    searchParams.set("tab", value);
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Classes & sections"
        subtitle="Organise students into classes and teaching groups"
        actions={
          canManage ? (
            tab === "classes" ? (
              <ClassFormButton classes={classes} onSaved={() => { classesData.reload(); sectionsList.reload(); }} />
            ) : (
              <SectionFormButton classes={classes} years={years} classFilter={classFilter} onSaved={() => { sectionsList.reload(); classesData.reload(); }} />
            )
          ) : null
        }
      />

      <Tabs
        tabs={[
          { value: "classes", label: "Classes", count: classesData.data.length },
          { value: "sections", label: "Sections", count: sectionsList.count },
        ]}
        value={tab}
        onChange={changeTab}
      />

      {tab === "classes" ? (
        classesData.loading ? (
          <Loading />
        ) : classesData.data.length ? (
          <ClassGrid
            classes={classesData.data}
            canManage={canManage}
            onChanged={classesData.reload}
            onOpenSections={(uuid) => {
              setClassFilter(uuid);
              changeTab("sections");
            }}
          />
        ) : (
          <EmptyState icon={BookOpen} title="No classes yet" description="Create the school's class structure first." />
        )
      ) : (
        <>
          <div className="filters" style={{ marginBottom: 14 }}>
            <select className="select" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="">All classes</option>
              {classes.map((item) => <option key={item.uuid} value={item.uuid}>{item.name}</option>)}
            </select>
            {classFilter ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClassFilter("")}>Clear</button>
            ) : null}
          </div>
          {sectionsList.loading ? (
            <Loading />
          ) : sectionsList.rows.length ? (
            <Card flush>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Class teacher</th>
                      <th>Room</th>
                      <th>Students</th>
                      <th>Subjects</th>
                      <th>Academic year</th>
                      <th className="actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionsList.rows.map((section) => (
                      <tr key={section.uuid}>
                        <td>
                          <div className="cell-main">{section.school_class_name} — {section.name}</div>
                          <div className="cell-sub">{section.display_name}</div>
                        </td>
                        <td>
                          {section.class_teacher_detail ? (
                            <div className="cell-user">
                              <Avatar name={section.class_teacher_detail.full_name} size="sm" />
                              <span>{section.class_teacher_detail.full_name}</span>
                            </div>
                          ) : (
                            <span className="cell-sub">Unassigned</span>
                          )}
                        </td>
                        <td>{section.room || "—"}</td>
                        <td>
                          <Badge tone={section.student_count >= section.capacity ? "amber" : "neutral"}>
                            {section.student_count} / {section.capacity}
                          </Badge>
                        </td>
                        <td>{section.subject_count}</td>
                        <td className="cell-sub">{section.academic_year ? years.find((year) => year.uuid === section.academic_year)?.name || "—" : "—"}</td>
                        <td className="actions">
                          <RosterButton section={section} />
                          {canManage ? <SectionEditDelete section={section} classes={classes} years={years} onChanged={sectionsList.reload} /> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={sectionsList.page} totalPages={sectionsList.totalPages} count={sectionsList.count} onPage={sectionsList.setPage} label="sections" />
            </Card>
          ) : (
            <EmptyState icon={Layers} title="No sections found" description={classFilter ? "This class has no sections yet." : "Create a section to group students."} />
          )}
        </>
      )}
    </>
  );
}

function ClassGrid({ classes, canManage, onChanged, onOpenSections }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/academics/classes/${deleting.uuid}/`);
      toast.success("Class removed.");
      setDeleting(null);
      onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid-3">
        {classes.map((item) => (
          <Card key={item.uuid}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div className="stat-icon indigo" style={{ width: 42, height: 42 }}>
                <BookOpen size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16 }}>{item.name}</h3>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Level {item.level}</div>
              </div>
              {canManage ? (
                <div style={{ display: "flex", gap: 2 }}>
                  <button type="button" className="icon-btn" onClick={() => setEditing(item)} title="Edit class"><Pencil size={15} /></button>
                  <button type="button" className="icon-btn danger" onClick={() => setDeleting(item)} title="Delete class"><Trash2 size={15} /></button>
                </div>
              ) : null}
            </div>
            {item.description ? (
              <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.description}</p>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Badge tone="indigo">{item.sections_count} section{item.sections_count === 1 ? "" : "s"}</Badge>
              <Badge tone="green">{item.students_count} students</Badge>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 14, width: "100%" }} onClick={() => onOpenSections(item.uuid)}>
              View sections
            </button>
          </Card>
        ))}
      </div>

      <ClassFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        item={editing}
        onSaved={() => { setEditing(null); onChanged(); }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete this class?"
        message={`${deleting?.name} can only be deleted when it has no sections. This action cannot be undone.`}
        confirmLabel="Delete class"
      />
    </>
  );
}

function ClassFormButton({ onSaved }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New class</button>
      <ClassFormModal open={open} onClose={() => setOpen(false)} item={null} onSaved={() => { setOpen(false); onSaved(); }} />
    </>
  );
}

function ClassFormModal({ open, onClose, item, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", level: "", description: "", is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? { name: item.name, level: item.level, description: item.description || "", is_active: item.is_active } : { name: "", level: "", description: "", is_active: true });
  }, [open, item]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, level: Number(form.level) };
      if (item) await api.patch(`/academics/classes/${item.uuid}/`, payload);
      else await api.post("/academics/classes/", payload);
      toast.success(item ? "Class updated." : "Class created.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Edit class" : "Create class"}
      size="modal-sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="class-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="class-form" onSubmit={submit}>
        <Field label="Class name" required hint="e.g. Grade 6">
          <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </Field>
        <Field label="Level" required hint="Numeric ordering, e.g. 6">
          <input className="input" type="number" min="1" value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))} required />
        </Field>
        <Field label="Description">
          <textarea className="textarea" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <Toggle checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label="Active" />
      </form>
    </Modal>
  );
}

function SectionFormButton({ classes, years, classFilter, onSaved }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New section</button>
      <SectionFormModal open={open} onClose={() => setOpen(false)} item={null} classes={classes} years={years} defaultClass={classFilter} onSaved={() => { setOpen(false); onSaved(); }} />
    </>
  );
}

function SectionEditDelete({ section, classes, years, onChanged }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/academics/sections/${section.uuid}/`);
      toast.success("Section removed.");
      setDeleting(false);
      onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="icon-btn" title="Edit section" onClick={() => setEditing(true)}><Pencil size={15} /></button>
      <button type="button" className="icon-btn danger" title="Delete section" onClick={() => setDeleting(true)}><Trash2 size={15} /></button>
      <SectionFormModal open={editing} onClose={() => setEditing(false)} item={section} classes={classes} years={years} onSaved={() => { setEditing(false); onChanged(); }} />
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={remove} busy={busy} title="Delete this section?" message={`${section.display_name} can only be deleted when it has no students.`} confirmLabel="Delete section" />
    </>
  );
}

function SectionFormModal({ open, onClose, item, classes, years, defaultClass, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ school_class: "", name: "", academic_year: "", class_teacher: "", room: "", capacity: 40, is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data: teacherUsers } = useAll("/accounts/users/", { role: "Teacher" }, { enabled: open });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) {
      setForm({
        school_class: item.school_class_uuid || item.school_class || "",
        name: item.name,
        academic_year: item.academic_year || "",
        class_teacher: item.class_teacher || "",
        room: item.room || "",
        capacity: item.capacity || 40,
        is_active: item.is_active ?? true,
      });
    } else {
      setForm({ school_class: defaultClass || "", name: "", academic_year: years.find((year) => year.is_current)?.uuid || "", class_teacher: "", room: "", capacity: 40, is_active: true });
    }
  }, [open, item, defaultClass, years]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity),
        academic_year: form.academic_year || null,
        class_teacher: form.class_teacher || null,
      };
      if (item) await api.patch(`/academics/sections/${item.uuid}/`, payload);
      else await api.post("/academics/sections/", payload);
      toast.success(item ? "Section updated." : "Section created.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Edit section" : "Create section"}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="section-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="section-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="Class" required>
            <select className="select" value={form.school_class} onChange={(event) => setForm((current) => ({ ...current, school_class: event.target.value }))} required>
              <option value="">Select class…</option>
              {classes.map((item2) => <option key={item2.uuid} value={item2.uuid}>{item2.name}</option>)}
            </select>
          </Field>
          <Field label="Section name" required hint="e.g. A, B or Blue">
            <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required maxLength={20} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Academic year">
            <select className="select" value={form.academic_year} onChange={(event) => setForm((current) => ({ ...current, academic_year: event.target.value }))}>
              <option value="">Not set</option>
              {years.map((year) => <option key={year.uuid} value={year.uuid}>{year.name}{year.is_current ? " (current)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Class teacher">
            <select className="select" value={form.class_teacher} onChange={(event) => setForm((current) => ({ ...current, class_teacher: event.target.value }))}>
              <option value="">Unassigned</option>
              {teacherUsers.map((user) => <option key={user.uuid} value={user.uuid}>{user.full_name}</option>)}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Room">
            <input className="input" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="e.g. 204" />
          </Field>
          <Field label="Capacity">
            <input className="input" type="number" min="1" max="200" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} />
          </Field>
        </div>
        <Toggle checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label="Active" />
      </form>
    </Modal>
  );
}

function RosterButton({ section }) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      setStudents(await api.get(`/academics/sections/${section.uuid}/roster/`));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="icon-btn" title="View roster" onClick={load}><Users size={15} /></button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${section.school_class_name} — ${section.name}`} subtitle="Class roster" size="modal-lg">
        <ErrorBanner error={error} />
        {loading ? <Loading /> : students.length ? (
          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>Student</th><th>Student ID</th><th>Roll</th><th>Status</th></tr></thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.uuid}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={student.user?.full_name} size="sm" />
                        <span className="cell-main">{student.user?.full_name}</span>
                      </div>
                    </td>
                    <td>{student.student_id}</td>
                    <td>{student.roll_number ?? "—"}</td>
                    <td><StatusBadge status={student.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Users} title="No students in this section" />}
      </Modal>
    </>
  );
}
