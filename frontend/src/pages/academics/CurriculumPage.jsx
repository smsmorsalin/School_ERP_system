import { useEffect, useState } from "react";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { useAll, useList, useReferenceData } from "../../lib/hooks";
import {
  Avatar,
  Badge,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  Pagination,
  Spinner,
  Toggle,
  Toolbar,
} from "../../components/ui";

/**
 * Curriculum is the join between a section, a subject and a teacher.
 * It is a scheduling decision, so it gets its own workspace.
 */
export default function CurriculumPage() {
  usePageTitle("Curriculum");
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [section, setSection] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { sections, subjects } = useReferenceData({ sections: true, subjects: true });
  const list = useList("/academics/class-subjects/", {
    ordering: "section__school_class__level,subject__name",
  });
  const { data: teachers } = useAll("/accounts/users/", { role: "Teacher" }, { enabled: isAdmin });

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
      <PageHeader
        title="Curriculum"
        subtitle="Which subjects each section studies, and who teaches them."
        meta={<Badge tone="indigo">{list.count} assignments</Badge>}
        actions={
          isAdmin ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} /> Assign subject
            </button>
          ) : null
        }
      />

      <Card flush>
        <Toolbar meta={<span>{list.count} section-subject assignments</span>}>
          <select
            className="select"
            aria-label="Filter by section"
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="">All sections</option>
            {sections.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.display_name}
              </option>
            ))}
          </select>
        </Toolbar>

        {list.loading ? (
          <Loading />
        ) : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th>Status</th>
                    {isAdmin ? <th className="actions">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((item) => (
                    <tr key={item.uuid}>
                      <td className="cell-main">
                        {item.section_detail
                          ? `${item.section_detail.school_class_name} — ${item.section_detail.name}`
                          : "—"}
                      </td>
                      <td>
                        {item.subject_detail?.name || "—"}{" "}
                        <span className="cell-sub">{item.subject_detail?.code}</span>
                      </td>
                      <td>
                        {item.teacher_detail ? (
                          <div className="cell-user">
                            <Avatar name={item.teacher_detail.full_name} size="sm" />
                            <span>{item.teacher_detail.full_name}</span>
                          </div>
                        ) : (
                          <span className="cell-sub">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={item.is_active ? "green" : "neutral"}>
                          {item.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      {isAdmin ? (
                        <td className="actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Edit class subject"
                            onClick={() => {
                              setEditing(item);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label="Delete class subject"
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      ) : null}
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
              label="assignments"
            />
          </>
        ) : (
          <EmptyState
            icon={Link2}
            title="No curriculum yet"
            description="Assign subjects to sections and nominate the teacher who will take them."
          />
        )}
      </Card>

      <AssignmentDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        sections={sections}
        subjects={subjects}
        teachers={teachers}
        onSaved={() => {
          setFormOpen(false);
          list.reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Remove this assignment?"
        message="The subject will no longer be attached to this section."
        confirmLabel="Remove assignment"
      />
    </>
  );
}

function AssignmentDrawer({ open, onClose, item, sections, subjects, teachers, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ section: "", subject: "", teacher: "", is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? { section: item.section, subject: item.subject, teacher: item.teacher || "", is_active: item.is_active }
        : { section: "", subject: "", teacher: "", is_active: true }
    );
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
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? "Edit assignment" : "Assign subject to section"}
      subtitle="One subject can be assigned to many sections."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="curriculum-drawer-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save assignment
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="curriculum-drawer-form" onSubmit={submit}>
        <Field label="Section" required>
          <select
            className="select"
            value={form.section}
            onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}
            required
          >
            <option value="">Select section…</option>
            {sections.map((section) => (
              <option key={section.uuid} value={section.uuid}>
                {section.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject" required>
          <select
            className="select"
            value={form.subject}
            onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            required
          >
            <option value="">Select subject…</option>
            {subjects.map((subject) => (
              <option key={subject.uuid} value={subject.uuid}>
                {subject.name} ({subject.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Teacher" hint="Leave unassigned until a teacher is allocated.">
          <select
            className="select"
            value={form.teacher}
            onChange={(event) => setForm((current) => ({ ...current, teacher: event.target.value }))}
          >
            <option value="">Unassigned</option>
            {teachers.map((teacher) => (
              <option key={teacher.uuid} value={teacher.uuid}>
                {teacher.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          checked={form.is_active}
          onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
          label="Active assignment"
        />
      </form>
    </Drawer>
  );
}
