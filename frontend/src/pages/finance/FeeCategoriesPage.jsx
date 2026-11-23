import { useEffect, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { useList } from "../../lib/hooks";
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
  Spinner,
  Toggle,
  Toolbar,
} from "../../components/ui";

/** Categories are billing vocabulary, not fee amounts. Keep them separate. */
export default function FeeCategoriesPage() {
  usePageTitle("Fee categories");
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
      <PageHeader
        title="Fee categories"
        subtitle="The billing items available when building class fees."
        meta={<Badge tone="indigo">{list.count} categories</Badge>}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> New category
          </button>
        }
      />

      <Card flush>
        <Toolbar meta={<span>{list.count} categories</span>}>
          <span className="toolbar-note">Examples: Tuition, Transport, Library, Examination</span>
        </Toolbar>

        {list.loading ? (
          <Loading />
        ) : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th className="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((item) => (
                    <tr key={item.uuid}>
                      <td className="cell-main">
                        <Tags size={14} className="row-icon" />
                        {item.name}
                      </td>
                      <td className="cell-sub">{item.description || "—"}</td>
                      <td>
                        <Badge tone={item.is_active ? "green" : "neutral"}>
                          {item.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="actions">
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
              label="categories"
            />
          </>
        ) : (
          <EmptyState
            icon={Tags}
            title="No fee categories"
            description="Create categories such as Tuition, Transport or Library."
          />
        )}
      </Card>

      <CategoryDrawer
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
        title="Delete this category?"
        message={`${deleting?.name} can only be deleted when it is not used by a fee structure.`}
        confirmLabel="Delete category"
      />
    </>
  );
}

function CategoryDrawer({ open, onClose, item, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", description: "", is_active: true });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? { name: item.name, description: item.description || "", is_active: item.is_active }
        : { name: "", description: "", is_active: true }
    );
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
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? "Edit category" : "New fee category"}
      subtitle="Categories group similar charges on invoices and reports."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="category-drawer-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner size={15} light /> : null} Save category
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="category-drawer-form" onSubmit={submit}>
        <Field label="Name" required>
          <input
            className="input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </Field>
        <Field label="Description">
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
          label="Active category"
        />
      </form>
    </Drawer>
  );
}
