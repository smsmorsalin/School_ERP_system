import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Layers, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { useAll, useReferenceData } from "../../lib/hooks";
import {
  Badge,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  SectionRule,
  Spinner,
  Toggle,
} from "../../components/ui";

/**
 * Class structure lives on its own page. Sections, curriculum and students
 * are separate workflows, so this screen only answers "what grades exist?".
 */
export default function ClassesPage() {
  usePageTitle("Classes");
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const classes = useAll("/academics/classes/", { ordering: "level" });
  const { sections } = useReferenceData({ sections: true });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/academics/classes/${deleting.uuid}/`);
      toast.success("Class removed.");
      setDeleting(null);
      classes.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const totalSections = classes.data.reduce((sum, item) => sum + (item.sections_count || 0), 0);
  const totalStudents = classes.data.reduce((sum, item) => sum + (item.students_count || 0), 0);

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Grade levels that organise the school. Open a class to review its sections."
        meta={
          <>
            <Badge tone="indigo">{classes.data.length} classes</Badge>
            <Badge tone="neutral">{totalSections} sections</Badge>
            <Badge tone="green">{totalStudents} students</Badge>
          </>
        }
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
              <Plus size={16} /> New class
            </button>
          ) : null
        }
      />

      {classes.loading ? (
        <Loading />
      ) : classes.data.length ? (
        <div className="grid-3">
          {classes.data.map((item) => (
            <Card key={item.uuid} className="class-card">
              <div className="class-card-head">
                <div className="stat-icon indigo">
                  <BookOpen size={18} />
                </div>
                <div className="class-card-title">
                  <h3>{item.name}</h3>
                  <span>Level {item.level}</span>
                </div>
                {isAdmin ? (
                  <div className="class-card-tools">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Edit class"
                      onClick={() => {
                        setEditing(item);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="icon-btn danger" title="Delete class" onClick={() => setDeleting(item)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}
              </div>

              {item.description ? <p className="class-card-desc">{item.description}</p> : null}

              <div className="class-card-metrics">
                <div>
                  <span className="metric-label">Sections</span>
                  <strong>{item.sections_count}</strong>
                </div>
                <div>
                  <span className="metric-label">Students</span>
                  <strong>{item.students_count}</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm class-card-open"
                onClick={() => navigate(`/academics/sections?class=${item.uuid}`)}
              >
                <Layers size={14} /> View sections
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No classes yet"
          description="Create the school's class structure first, then add sections to each class."
          action={
            isAdmin ? (
              <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
                <Plus size={16} /> Create first class
              </button>
            ) : null
          }
        />
      )}

      {sections.length ? (
        <>
          <SectionRule>Class overview</SectionRule>
          <Card flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Level</th>
                    <th className="num">Sections</th>
                    <th className="num">Students</th>
                    <th className="actions">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.data.map((item) => (
                    <tr key={`row-${item.uuid}`}>
                      <td className="cell-main">{item.name}</td>
                      <td>{item.level}</td>
                      <td className="num">{item.sections_count}</td>
                      <td className="num">{item.students_count}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/academics/sections?class=${item.uuid}`)}
                        >
                          Sections <Users size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      <ClassDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        onSaved={() => {
          setFormOpen(false);
          classes.reload();
        }}
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

function ClassDrawer({ open, onClose, item, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", level: "", description: "", is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? { name: item.name, level: item.level, description: item.description || "", is_active: item.is_active }
        : { name: "", level: "", description: "", is_active: true }
    );
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
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? "Edit class" : "New class"}
      subtitle="Grade levels are ordered by their numeric level."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="class-drawer-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save class
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="class-drawer-form" onSubmit={submit}>
        <Field label="Class name" required hint="e.g. Grade 6">
          <input
            className="input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </Field>
        <Field label="Level" required hint="Numeric ordering, e.g. 6">
          <input
            className="input"
            type="number"
            min="1"
            value={form.level}
            onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
            required
          />
        </Field>
        <Field label="Description" hint="Optional note shown on the class card.">
          <textarea
            className="textarea"
            rows={4}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </Field>
        <Toggle
          checked={form.is_active}
          onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
          label="Active class"
        />
      </form>
    </Drawer>
  );
}
