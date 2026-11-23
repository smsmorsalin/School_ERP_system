import { useEffect, useState } from "react";
import { CalendarClock, FilePlus2, Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { formatDate, money, todayISO } from "../../lib/format";
import { useList, useReferenceData } from "../../lib/hooks";
import {
  Badge,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Spinner,
  Toolbar,
} from "../../components/ui";

/** Fee structures describe what a class is billed. Invoicing is a later step. */
export default function FeeStructuresPage() {
  usePageTitle("Fee structures");
  const toast = useToast();
  const [schoolClass, setSchoolClass] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [busy, setBusy] = useState(false);
  const { years, classes, categories } = useReferenceData({ years: true, classes: true, categories: true });
  const list = useList("/finance/fee-structures/", { ordering: "due_date" });

  useEffect(() => {
    list.update({ school_class: schoolClass, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/finance/fee-structures/${deleting.uuid}/`);
      toast.success("Fee structure removed.");
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
        title="Fee structures"
        subtitle="What each class is billed, and when it is due. Generate invoices once a fee is ready."
        meta={<Badge tone="indigo">{list.count} fees</Badge>}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> New fee
          </button>
        }
      />

      <Card flush>
        <Toolbar meta={<span>{list.count} fee structures</span>}>
          <select className="select" aria-label="Filter by class" value={schoolClass} onChange={(event) => setSchoolClass(event.target.value)}>
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.name}
              </option>
            ))}
          </select>
          {schoolClass ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSchoolClass("")}>
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
                    <th>Fee</th>
                    <th>Class</th>
                    <th>Category</th>
                    <th>Academic year</th>
                    <th className="num">Amount</th>
                    <th>Due date</th>
                    <th className="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((item) => (
                    <tr key={item.uuid}>
                      <td>
                        <div className="cell-main">{item.title}</div>
                        {item.description ? <div className="cell-sub">{item.description}</div> : null}
                      </td>
                      <td>{item.class_name}</td>
                      <td>
                        <Badge tone="neutral">{item.category_name}</Badge>
                      </td>
                      <td className="cell-sub">{item.academic_year_name}</td>
                      <td className="num cell-main">{money(item.amount)}</td>
                      <td className="num">{formatDate(item.due_date)}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setGenerating(item)}
                          title="Generate invoices"
                        >
                          <FilePlus2 size={13} /> Generate
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Edit"
                          onClick={() => {
                            setEditing(item);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="icon-btn danger" aria-label="Delete" onClick={() => setDeleting(item)}>
                          <Trash2 size={15} />
                        </button>
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
              label="fees"
            />
          </>
        ) : (
          <EmptyState
            icon={Wallet}
            title="No fee structures"
            description="Create a fee, assign it to a class and set the due date."
          />
        )}
      </Card>

      <FeeStructureDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        years={years}
        classes={classes}
        categories={categories}
        onSaved={() => {
          setFormOpen(false);
          list.reload();
        }}
      />
      <GenerateInvoicesModal structure={generating} onClose={() => setGenerating(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete this fee?"
        message={`${deleting?.title} will no longer be available for new invoices. Existing invoices are preserved.`}
        confirmLabel="Delete fee"
      />
    </>
  );
}

function FeeStructureDrawer({ open, onClose, item, years, classes, categories, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    academic_year: "",
    school_class: "",
    category: "",
    title: "",
    amount: "",
    due_date: todayISO(),
    description: "",
    is_active: true,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? {
            academic_year: item.academic_year,
            school_class: item.school_class,
            category: item.category,
            title: item.title,
            amount: item.amount,
            due_date: item.due_date,
            description: item.description || "",
            is_active: item.is_active,
          }
        : {
            academic_year: years.find((year) => year.is_current)?.uuid || "",
            school_class: "",
            category: "",
            title: "",
            amount: "",
            due_date: todayISO(),
            description: "",
            is_active: true,
          }
    );
  }, [open, item, years]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (item) await api.patch(`/finance/fee-structures/${item.uuid}/`, payload);
      else await api.post("/finance/fee-structures/", payload);
      toast.success(item ? "Fee updated." : "Fee created.");
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
      title={item ? "Edit fee structure" : "New fee structure"}
      subtitle="A fee belongs to one class and one academic year."
      size="drawer-lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="fee-drawer-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save fee
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="fee-drawer-form" onSubmit={submit}>
        <Field label="Fee title" required hint="Shown on invoices, e.g. Tuition — Term 1">
          <input
            className="input"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
        </Field>
        <div className="field-row">
          <Field label="Academic year" required>
            <select
              className="select"
              value={form.academic_year}
              onChange={(event) => setForm((current) => ({ ...current, academic_year: event.target.value }))}
              required
            >
              <option value="">Select year…</option>
              {years.map((year) => (
                <option key={year.uuid} value={year.uuid}>
                  {year.name}
                </option>
              ))}
            </select>
          </Field>
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
        </div>
        <div className="field-row">
          <Field label="Category" required>
            <select
              className="select"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              required
            >
              <option value="">Select category…</option>
              {categories.map((category) => (
                <option key={category.uuid} value={category.uuid}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount" required>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              required
            />
          </Field>
        </div>
        <Field label="Due date" required>
          <input
            className="input"
            type="date"
            value={form.due_date}
            onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
            required
          />
        </Field>
        <Field label="Description">
          <textarea
            className="textarea"
            rows={3}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </Field>
      </form>
    </Drawer>
  );
}

function GenerateInvoicesModal({ structure, onClose }) {
  const toast = useToast();
  const { sections } = useReferenceData({ sections: true });
  const [section, setSection] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!structure) return;
    setSection("");
    setDueDate(structure.due_date || "");
    setError(null);
  }, [structure]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post("/finance/invoices/generate/", {
        fee_structure: structure.uuid,
        section: section || null,
        due_date: dueDate || undefined,
      });
      toast.success(result.detail, "Invoices generated");
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!structure) return null;
  const options = sections.filter((item) => item.school_class_uuid === structure.school_class);

  return (
    <Modal
      open
      onClose={onClose}
      title="Generate invoices"
      subtitle={structure.title}
      size="modal-sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="generate-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : <Receipt size={15} />} Generate
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="notice info" style={{ marginBottom: 14 }}>
        <CalendarClock size={15} /> {money(structure.amount)} per student in {structure.class_name}. Existing invoices
        are skipped.
      </div>
      <form id="generate-form" onSubmit={submit}>
        <Field label="Section" hint="Leave blank to bill every active student in the class.">
          <select className="select" aria-label="Filter by section" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {options.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
