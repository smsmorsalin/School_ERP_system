import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layers, Pencil, Plus, Trash2, Users } from "lucide-react";
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
  StatusBadge,
  Toggle,
  Toolbar,
} from "../../components/ui";

/**
 * Sections are teaching groups inside a class. They have their own page
 * because they carry class teachers, rooms, capacity and rosters.
 */
export default function SectionsPage() {
  usePageTitle("Sections");
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classFilter, setClassFilter] = useState(searchParams.get("class") || "");
  const { classes, years } = useReferenceData({ classes: true, years: true });
  const list = useList("/academics/sections/", {}, { pageSize: 50 });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (classFilter) next.set("class", classFilter);
    else next.delete("class");
    setSearchParams(next, { replace: true });
    list.update({ school_class: classFilter, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFilter]);

  return (
    <>
      <PageHeader
        title="Sections"
        subtitle="Teaching groups, class teachers and rooms inside each class."
        meta={
          <>
            <Badge tone="indigo">{list.count} sections</Badge>
            {classFilter ? (
              <Badge tone="neutral">
                {classes.find((item) => item.uuid === classFilter)?.name || "Filtered class"}
              </Badge>
            ) : null}
          </>
        }
        actions={
          isAdmin ? (
            <SectionDrawerButton
              classes={classes}
              years={years}
              defaultClass={classFilter}
              onSaved={() => list.reload()}
            />
          ) : null
        }
      />

      <Card flush>
        <Toolbar
          meta={
            <span>
              Showing <strong>{list.rows.length}</strong> of <strong>{list.count}</strong>
            </span>
          }
        >
          <select
            className="select"
            aria-label="Filter by class"
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.name}
              </option>
            ))}
          </select>
          {classFilter ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClassFilter("")}>
              Clear
            </button>
          ) : null}
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
                    <th>Class teacher</th>
                    <th>Room</th>
                    <th className="num">Students</th>
                    <th className="num">Subjects</th>
                    <th>Academic year</th>
                    <th className="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((section) => (
                    <tr key={section.uuid}>
                      <td>
                        <div className="cell-main">
                          {section.school_class_name} — {section.name}
                        </div>
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
                      <td className="num">{section.subject_count}</td>
                      <td className="cell-sub">
                        {section.academic_year
                          ? years.find((year) => year.uuid === section.academic_year)?.name || "—"
                          : "—"}
                      </td>
                      <td className="actions">
                        <RosterButton section={section} />
                        {isAdmin ? (
                          <SectionEditDelete
                            section={section}
                            classes={classes}
                            years={years}
                            onChanged={list.reload}
                          />
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
              label="sections"
            />
          </>
        ) : (
          <EmptyState
            icon={Layers}
            title="No sections found"
            description={
              classFilter
                ? "This class has no sections yet. Add the first teaching group."
                : "Create a section to group students and assign a class teacher."
            }
          />
        )}
      </Card>
    </>
  );
}

function SectionDrawerButton({ classes, years, defaultClass, onSaved }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> New section
      </button>
      <SectionDrawer
        open={open}
        onClose={() => setOpen(false)}
        item={null}
        classes={classes}
        years={years}
        defaultClass={defaultClass}
        onSaved={() => {
          setOpen(false);
          onSaved();
        }}
      />
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
      <button type="button" className="icon-btn" title="Edit section" onClick={() => setEditing(true)}>
        <Pencil size={15} />
      </button>
      <button type="button" className="icon-btn danger" title="Delete section" onClick={() => setDeleting(true)}>
        <Trash2 size={15} />
      </button>
      <SectionDrawer
        open={editing}
        onClose={() => setEditing(false)}
        item={section}
        classes={classes}
        years={years}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        busy={busy}
        title="Delete this section?"
        message={`${section.display_name} can only be deleted when it has no students.`}
        confirmLabel="Delete section"
      />
    </>
  );
}

function SectionDrawer({ open, onClose, item, classes, years, defaultClass, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    school_class: "",
    name: "",
    academic_year: "",
    class_teacher: "",
    room: "",
    capacity: 40,
    is_active: true,
  });
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
      setForm({
        school_class: defaultClass || "",
        name: "",
        academic_year: years.find((year) => year.is_current)?.uuid || "",
        class_teacher: "",
        room: "",
        capacity: 40,
        is_active: true,
      });
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
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? "Edit section" : "New section"}
      subtitle="A section belongs to one class and one academic year."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="section-drawer-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save section
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="section-drawer-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="Class" required>
            <select
              className="select"
              value={form.school_class}
              onChange={(event) => setForm((current) => ({ ...current, school_class: event.target.value }))}
              required
            >
              <option value="">Select class…</option>
              {classes.map((item2) => (
                <option key={item2.uuid} value={item2.uuid}>
                  {item2.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section name" required hint="e.g. A, B or Blue">
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              maxLength={20}
            />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Academic year">
            <select
              className="select"
              value={form.academic_year}
              onChange={(event) => setForm((current) => ({ ...current, academic_year: event.target.value }))}
            >
              <option value="">Not set</option>
              {years.map((year) => (
                <option key={year.uuid} value={year.uuid}>
                  {year.name}
                  {year.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class teacher">
            <select
              className="select"
              value={form.class_teacher}
              onChange={(event) => setForm((current) => ({ ...current, class_teacher: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {teacherUsers.map((user) => (
                <option key={user.uuid} value={user.uuid}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Room">
            <input
              className="input"
              value={form.room}
              onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}
              placeholder="e.g. 204"
            />
          </Field>
          <Field label="Capacity">
            <input
              className="input"
              type="number"
              min="1"
              max="200"
              value={form.capacity}
              onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
            />
          </Field>
        </div>
        <Toggle
          checked={form.is_active}
          onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
          label="Active section"
        />
      </form>
    </Drawer>
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
      <button type="button" className="icon-btn" title="View roster" onClick={load}>
        <Users size={15} />
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={`${section.school_class_name} — ${section.name}`}
        subtitle="Class roster"
        size="drawer-lg"
      >
        <ErrorBanner error={error} />
        {loading ? (
          <Loading />
        ) : students.length ? (
          <div className="table-wrap">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Roll</th>
                  <th>Status</th>
                </tr>
              </thead>
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
                    <td>
                      <StatusBadge status={student.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No students in this section" description="Admit students and assign them to this section." />
        )}
      </Drawer>
    </>
  );
}
