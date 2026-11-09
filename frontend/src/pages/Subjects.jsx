import { useEffect, useState } from "react";
import { BookMarked, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { useAll, useDebounced, useList, useReferenceData } from "../lib/hooks";
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
  Tabs,
  Toggle,
} from "../components/ui";

export default function Subjects() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("subjects");
  return (
    <>
      <PageHeader title="Subjects" subtitle="Curriculum subjects and class assignments" />
      <Tabs tabs={[{ value: "subjects", label: "Subjects" }, { value: "assignments", label: "Class assignments" }]} value={tab} onChange={setTab} />
      {tab === "subjects" ? <SubjectsTab canManage={isAdmin} /> : <AssignmentsTab canManage={isAdmin} />}
    </>
  );
}

function SubjectsTab({ canManage }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useList("/academics/subjects/", { ordering: "name" });

  useEffect(() => {
    list.update({ search: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/academics/subjects/${deleting.uuid}/`);
      toast.success("Subject removed.");
      setDeleting(null);
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search subject or code…" />
          {canManage ? (
            <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={15} /> New subject
            </button>
          ) : null}
        </div>
        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Subject</th><th>Code</th><th>Credits</th><th>Description</th><th>Status</th>{canManage ? <th className="actions">Actions</th> : null}</tr></thead>
                <tbody>
                  {list.rows.map((subject) => (
                    <tr key={subject.uuid}>
                      <td className="cell-main">{subject.name}</td>
                      <td><Badge tone="indigo">{subject.code}</Badge></td>
                      <td>{subject.credits}</td>
                      <td className="cell-sub" style={{ maxWidth: 320 }}>{subject.description || "—"}</td>
                      <td><Badge tone={subject.is_active ? "green" : "neutral"}>{subject.is_active ? "Active" : "Inactive"}</Badge></td>
                      {canManage ? (
                        <td className="actions">
                          <button type="button" className="icon-btn" onClick={() => { setEditing(subject); setFormOpen(true); }}><Pencil size={15} /></button>
                          <button type="button" className="icon-btn danger" onClick={() => setDeleting(subject)}><Trash2 size={15} /></button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="subjects" />
          </>
        ) : (
          <EmptyState icon={BookMarked} title="No subjects found" description={search ? "Try another search." : "Add the first subject to the curriculum."} />
        )}
      </Card>

      <SubjectFormModal open={formOpen} onClose={() => setFormOpen(false)} item={editing} onSaved={() => { setFormOpen(false); list.reload(); }} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this subject?" message={`${deleting?.name} can only be deleted when it is not used in timetables or exams.`} confirmLabel="Delete subject" />
    </>
  );
}

function SubjectFormModal({ open, onClose, item, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", code: "", description: "", credits: 1, is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? { name: item.name, code: item.code, description: item.description || "", credits: item.credits, is_active: item.is_active } : { name: "", code: "", description: "", credits: 1, is_active: true });
  }, [open, item]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, credits: Number(form.credits), code: form.code.trim().toUpperCase() };
      if (item) await api.patch(`/academics/subjects/${item.uuid}/`, payload);
      else await api.post("/academics/subjects/", payload);
      toast.success(item ? "Subject updated." : "Subject created.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit subject" : "New subject"} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="subject-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="subject-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="Subject name" required>
            <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </Field>
          <Field label="Code" required hint="Unique, e.g. MATH-6">
            <input className="input" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} required />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="textarea" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <Field label="Credits">
          <input className="input" type="number" min="1" max="20" value={form.credits} onChange={(event) => setForm((current) => ({ ...current, credits: event.target.value }))} />
        </Field>
        <Toggle checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label="Active" />
      </form>
    </Modal>
  );
}

function AssignmentsTab({ canManage }) {
  const toast = useToast();
  const [section, setSection] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { sections, subjects } = useReferenceData({ sections: true, subjects: true });
  const list = useList("/academics/class-subjects/", { ordering: "section__school_class__level,subject__name" });
  const { data: teachers } = useAll("/accounts/users/", { role: "Teacher" }, { enabled: canManage });

  useEffect(() => {
    list.update({ section, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/academics/class-subjects/${deleting.uuid}/`);
      toast.success("Assignment removed.");
      setDeleting(null);
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <select className="select" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {sections.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
          </select>
          {canManage ? (
            <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={15} /> Assign subject
            </button>
          ) : null}
        </div>
        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Section</th><th>Subject</th><th>Teacher</th><th>Status</th>{canManage ? <th className="actions">Actions</th> : null}</tr></thead>
                <tbody>
                  {list.rows.map((item) => (
                    <tr key={item.uuid}>
                      <td className="cell-main">{item.section_detail ? `${item.section_detail.school_class_name} — ${item.section_detail.name}` : "—"}</td>
                      <td>{item.subject_detail?.name || "—"} <span className="cell-sub">{item.subject_detail?.code}</span></td>
                      <td>
                        {item.teacher_detail ? (
                          <div className="cell-user"><Avatar name={item.teacher_detail.full_name} size="sm" /><span>{item.teacher_detail.full_name}</span></div>
                        ) : <span className="cell-sub">Unassigned</span>}
                      </td>
                      <td><Badge tone={item.is_active ? "green" : "neutral"}>{item.is_active ? "Active" : "Inactive"}</Badge></td>
                      {canManage ? (
                        <td className="actions">
                          <button type="button" className="icon-btn" onClick={() => { setEditing(item); setFormOpen(true); }}><Pencil size={15} /></button>
                          <button type="button" className="icon-btn danger" onClick={() => setDeleting(item)}><Trash2 size={15} /></button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="assignments" />
          </>
        ) : (
          <EmptyState icon={Link2} title="No assignments" description="Assign subjects to sections and teachers." />
        )}
      </Card>

      <AssignmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        sections={sections}
        subjects={subjects}
        teachers={teachers}
        onSaved={() => { setFormOpen(false); list.reload(); }}
      />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Remove this assignment?" message="The subject will no longer be attached to this section." confirmLabel="Remove assignment" />
    </>
  );
}

function AssignmentFormModal({ open, onClose, item, sections, subjects, teachers, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ section: "", subject: "", teacher: "", is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? { section: item.section, subject: item.subject, teacher: item.teacher || "", is_active: item.is_active } : { section: "", subject: "", teacher: "", is_active: true });
  }, [open, item]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, teacher: form.teacher || null };
      if (item) await api.patch(`/academics/class-subjects/${item.uuid}/`, payload);
      else await api.post("/academics/class-subjects/", payload);
      toast.success(item ? "Assignment updated." : "Subject assigned.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit assignment" : "Assign subject to class"} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="assignment-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="assignment-form" onSubmit={submit}>
        <Field label="Section" required>
          <select className="select" value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} required>
            <option value="">Select section…</option>
            {sections.map((section) => <option key={section.uuid} value={section.uuid}>{section.display_name}</option>)}
          </select>
        </Field>
        <Field label="Subject" required>
          <select className="select" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} required>
            <option value="">Select subject…</option>
            {subjects.map((subject) => <option key={subject.uuid} value={subject.uuid}>{subject.name} ({subject.code})</option>)}
          </select>
        </Field>
        <Field label="Teacher">
          <select className="select" value={form.teacher} onChange={(event) => setForm((current) => ({ ...current, teacher: event.target.value }))}>
            <option value="">Unassigned</option>
            {teachers.map((teacher) => <option key={teacher.uuid} value={teacher.uuid}>{teacher.full_name}</option>)}
          </select>
        </Field>
        <Toggle checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label="Active" />
      </form>
    </Modal>
  );
}
