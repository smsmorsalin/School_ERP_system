import { useEffect, useState } from "react";
import { BookMarked, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { useDebounced, useList } from "../../lib/hooks";
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
  Pagination,
  SearchInput,
  Spinner,
  Toggle,
  Toolbar,
} from "../../components/ui";

/** The subject catalogue is reference data: it does not belong beside timetables. */
export default function SubjectsPage() {
  usePageTitle("Subjects");
  const { isAdmin } = useAuth();
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
      <PageHeader
        title="Subject catalogue"
        subtitle="The reusable list of subjects taught across the school."
        meta={<Badge tone="indigo">{list.count} subjects</Badge>}
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
              <Plus size={16} /> New subject
            </button>
          ) : null
        }
      />

      <Card flush>
        <Toolbar meta={<span>{list.count} subjects in the catalogue</span>}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search subject or code…" />
        </Toolbar>

        {list.loading ? (
          <Loading />
        ) : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th className="num">Credits</th>
                    <th>Description</th>
                    <th>Status</th>
                    {isAdmin ? <th className="actions">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((subject) => (
                    <tr key={subject.uuid}>
                      <td className="cell-main">{subject.name}</td>
                      <td>
                        <Badge tone="indigo">{subject.code}</Badge>
                      </td>
                      <td className="num">{subject.credits}</td>
                      <td className="cell-sub" style={{ maxWidth: 360 }}>
                        {subject.description || "—"}
                      </td>
                      <td>
                        <Badge tone={subject.is_active ? "green" : "neutral"}>
                          {subject.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      {isAdmin ? (
                        <td className="actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Edit subject"
                            onClick={() => {
                              setEditing(subject);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label="Delete subject"
                            onClick={() => setDeleting(subject)}
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
              label="subjects"
            />
          </>
        ) : (
          <EmptyState
            icon={BookMarked}
            title="No subjects found"
            description={search ? "Try another search." : "Add the first subject to the curriculum catalogue."}
          />
        )}
      </Card>

      <SubjectDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
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
        title="Delete this subject?"
        message={`${deleting?.name} can only be deleted when it is not used in timetables or exams.`}
        confirmLabel="Delete subject"
      />
    </>
  );
}

function SubjectDrawer({ open, onClose, item, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", code: "", description: "", credits: 1, is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? {
            name: item.name,
            code: item.code,
            description: item.description || "",
            credits: item.credits,
            is_active: item.is_active,
          }
        : { name: "", code: "", description: "", credits: 1, is_active: true }
    );
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
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? "Edit subject" : "New subject"}
      subtitle="Subjects are reused by curriculum, timetable and examinations."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="subject-drawer-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save subject
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="subject-drawer-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="Subject name" required>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </Field>
          <Field label="Code" required hint="Unique, e.g. MATH-6">
            <input
              className="input"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              required
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className="textarea"
            rows={4}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </Field>
        <Field label="Credits" hint="Used for weighting and reporting.">
          <input
            className="input"
            type="number"
            min="1"
            max="20"
            value={form.credits}
            onChange={(event) => setForm((current) => ({ ...current, credits: event.target.value }))}
          />
        </Field>
        <Toggle
          checked={form.is_active}
          onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
          label="Active subject"
        />
      </form>
    </Drawer>
  );
}
