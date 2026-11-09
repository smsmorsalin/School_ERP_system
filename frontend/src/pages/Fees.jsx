import { useEffect, useState } from "react";
import { CalendarClock, FilePlus2, Layers, Pencil, Plus, Receipt, Tags, Trash2, Wallet } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, money, todayISO } from "../lib/format";
import { useList, useReferenceData } from "../lib/hooks";
import {
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
  Tabs,
  Toggle,
} from "../components/ui";

export default function Fees() {
  const [tab, setTab] = useState("structures");
  return (
    <>
      <PageHeader title="Fee setup" subtitle="Define fee categories and what each class is billed" />
      <Tabs
        tabs={[{ value: "structures", label: "Fee structures" }, { value: "categories", label: "Categories" }]}
        value={tab}
        onChange={setTab}
      />
      {tab === "structures" ? <StructuresTab /> : <CategoriesTab />}
    </>
  );
}

function CategoriesTab() {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useList("/finance/fee-categories/", { ordering: "name" });

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/finance/fee-categories/${deleting.uuid}/`);
      toast.success("Fee category removed.");
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
          <span className="cell-sub" style={{ flex: 1 }}>{list.count} categories</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> New category</button>
        </div>
        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Category</th><th>Description</th><th>Status</th><th className="actions">Actions</th></tr></thead>
                <tbody>
                  {list.rows.map((item) => (
                    <tr key={item.uuid}>
                      <td className="cell-main"><Tags size={14} style={{ verticalAlign: -2, marginRight: 6, color: "var(--muted)" }} />{item.name}</td>
                      <td className="cell-sub">{item.description || "—"}</td>
                      <td><Badge tone={item.is_active ? "green" : "neutral"}>{item.is_active ? "Active" : "Inactive"}</Badge></td>
                      <td className="actions">
                        <button type="button" className="icon-btn" onClick={() => { setEditing(item); setFormOpen(true); }}><Pencil size={15} /></button>
                        <button type="button" className="icon-btn danger" onClick={() => setDeleting(item)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="categories" />
          </>
        ) : <EmptyState icon={Tags} title="No fee categories" description="Create categories such as Tuition, Transport or Library." />}
      </Card>

      <CategoryFormModal open={formOpen} onClose={() => setFormOpen(false)} item={editing} onSaved={() => { setFormOpen(false); list.reload(); }} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this category?" message={`${deleting?.name} can only be deleted when it is not used by a fee structure.`} confirmLabel="Delete category" />
    </>
  );
}

function CategoryFormModal({ open, onClose, item, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", description: "", is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? { name: item.name, description: item.description || "", is_active: item.is_active } : { name: "", description: "", is_active: true });
  }, [open, item]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (item) await api.patch(`/finance/fee-categories/${item.uuid}/`, form);
      else await api.post("/finance/fee-categories/", form);
      toast.success(item ? "Category updated." : "Category created.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit category" : "New fee category"} size="modal-sm" footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="cat-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="cat-form" onSubmit={submit}>
        <Field label="Name" required>
          <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </Field>
        <Field label="Description">
          <textarea className="textarea" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <Toggle checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label="Active" />
      </form>
    </Modal>
  );
}

function StructuresTab() {
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
      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <select className="select" value={schoolClass} onChange={(event) => setSchoolClass(event.target.value)}>
            <option value="">All classes</option>
            {classes.map((item) => <option key={item.uuid} value={item.uuid}>{item.name}</option>)}
          </select>
          <span style={{ marginLeft: "auto" }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> New fee</button>
        </div>
        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Fee</th><th>Class</th><th>Category</th><th>Academic year</th><th className="num">Amount</th><th>Due date</th><th className="actions">Actions</th></tr></thead>
                <tbody>
                  {list.rows.map((item) => (
                    <tr key={item.uuid}>
                      <td><div className="cell-main">{item.title}</div><div className="cell-sub">{item.description || "—"}</div></td>
                      <td>{item.class_name}</td>
                      <td><Badge tone="neutral">{item.category_name}</Badge></td>
                      <td className="cell-sub">{item.academic_year_name}</td>
                      <td className="num cell-main">{money(item.amount)}</td>
                      <td>{formatDate(item.due_date)}</td>
                      <td className="actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGenerating(item)} title="Generate invoices">
                          <FilePlus2 size={13} /> Generate
                        </button>
                        <button type="button" className="icon-btn" onClick={() => { setEditing(item); setFormOpen(true); }}><Pencil size={15} /></button>
                        <button type="button" className="icon-btn danger" onClick={() => setDeleting(item)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="fees" />
          </>
        ) : <EmptyState icon={Wallet} title="No fee structures" description="Create a fee and assign it to a class." />}
      </Card>

      <FeeStructureFormModal open={formOpen} onClose={() => setFormOpen(false)} item={editing} years={years} classes={classes} categories={categories} onSaved={() => { setFormOpen(false); list.reload(); }} />
      <GenerateInvoicesModal structure={generating} onClose={() => setGenerating(null)} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this fee?" message={`${deleting?.title} will no longer be available for new invoices. Existing invoices are preserved.`} confirmLabel="Delete fee" />
    </>
  );
}

function FeeStructureFormModal({ open, onClose, item, years, classes, categories, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ academic_year: "", school_class: "", category: "", title: "", amount: "", due_date: todayISO(), description: "", is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? {
      academic_year: item.academic_year,
      school_class: item.school_class,
      category: item.category,
      title: item.title,
      amount: item.amount,
      due_date: item.due_date,
      description: item.description || "",
      is_active: item.is_active,
    } : {
      academic_year: years.find((year) => year.is_current)?.uuid || "",
      school_class: "",
      category: "",
      title: "",
      amount: "",
      due_date: todayISO(),
      description: "",
      is_active: true,
    });
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
    <Modal open={open} onClose={onClose} title={item ? "Edit fee structure" : "New fee structure"} size="modal-lg" footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="fee-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="fee-form" onSubmit={submit}>
        <Field label="Fee title" required hint="Shown on invoices, e.g. Tuition — Term 1">
          <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
        </Field>
        <div className="field-row">
          <Field label="Academic year" required>
            <select className="select" value={form.academic_year} onChange={(event) => setForm((current) => ({ ...current, academic_year: event.target.value }))} required>
              <option value="">Select year…</option>
              {years.map((year) => <option key={year.uuid} value={year.uuid}>{year.name}</option>)}
            </select>
          </Field>
          <Field label="Class" required>
            <select className="select" value={form.school_class} onChange={(event) => setForm((current) => ({ ...current, school_class: event.target.value }))} required>
              <option value="">Select class…</option>
              {classes.map((item2) => <option key={item2.uuid} value={item2.uuid}>{item2.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Category" required>
            <select className="select" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} required>
              <option value="">Select category…</option>
              {categories.map((category) => <option key={category.uuid} value={category.uuid}>{category.name}</option>)}
            </select>
          </Field>
          <Field label="Amount" required>
            <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
          </Field>
        </div>
        <Field label="Due date" required>
          <input className="input" type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} required />
        </Field>
        <Field label="Description">
          <textarea className="textarea" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>
      </form>
    </Modal>
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
    <Modal open onClose={onClose} title="Generate invoices" subtitle={structure.title} size="modal-sm" footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="generate-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : <Receipt size={15} />} Generate</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="notice info" style={{ marginBottom: 14 }}>
        <CalendarClock size={15} /> {money(structure.amount)} per student in {structure.class_name}. Existing invoices are skipped.
      </div>
      <form id="generate-form" onSubmit={submit}>
        <Field label="Section" hint="Leave blank to bill every active student in the class.">
          <select className="select" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {options.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
          </select>
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
