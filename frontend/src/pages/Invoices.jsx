import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Ban,
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { downloadCSV, formatDate, formatDateTime, money, statusTone, todayISO } from "../lib/format";
import { PAYMENT_METHODS } from "../lib/constants";
import { useDebounced, useFetch, useList, useReferenceData } from "../lib/hooks";
import OnlinePaymentModal from "../components/OnlinePaymentModal";
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
  StatCard,
  StatusBadge,
} from "../components/ui";

export default function Invoices() {
  const { isAdmin, hasRole } = useAuth();
  const canManage = isAdmin || hasRole("Accountant");
  return <InvoicesView canManage={canManage} />;
}

function InvoicesView({ canManage }) {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [section, setSection] = useState("");
  const [overdue, setOverdue] = useState(searchParams.get("overdue") === "true");
  const [student, setStudent] = useState(searchParams.get("student") || "");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [onlinePaying, setOnlinePaying] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { sections, students } = useReferenceData({ sections: true, students: canManage });
  const list = useList("/finance/invoices/", { ordering: "-created_at" });
  const overview = useFetch("/dashboard/overview/");

  useEffect(() => {
    list.update({ search: debounced, status, section, overdue: overdue ? "true" : "", student, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, status, section, overdue, student]);

  const fees = overview.data?.fees || {};
  const isFamily = !canManage;

  const openReceipt = async (invoice) => {
    setReceiptLoading(true);
    setReceipt({ invoice });
    try {
      setReceipt(await api.get(`/finance/invoices/${invoice.uuid}/receipt/`));
    } catch (error) {
      toast.error(error.message);
      setReceipt(null);
    } finally {
      setReceiptLoading(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/finance/invoices/${deleting.uuid}/`);
      toast.success("Invoice removed.");
      setDeleting(null);
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelInvoice = async (invoice) => {
    try {
      await api.post(`/finance/invoices/${invoice.uuid}/cancel/`, {});
      toast.success("Invoice cancelled.");
      list.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const exportRows = () => {
    downloadCSV(
      "invoices.csv",
      list.rows.map((row) => [row.invoice_number, row.student_name, row.title, row.amount, row.amount_paid, row.balance, row.due_date, row.effective_status]),
      ["Invoice", "Student", "Title", "Amount", "Paid", "Balance", "Due date", "Status"]
    );
  };

  return (
    <>
      <PageHeader
        title={isFamily ? "Fees & invoices" : "Invoices"}
        subtitle={isFamily ? "Your fee statements and payment history" : `${list.count} invoice(s)`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}><Download size={16} /> Export</button>
            {canManage ? <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> New invoice</button> : null}
          </>
        }
      />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <StatCard icon={Wallet} label="Billed" value={money(fees.billed)} hint={`${fees.invoice_count ?? 0} invoices`} tone="indigo" />
        <StatCard icon={Receipt} label="Collected" value={money(fees.collected)} hint="payments received" tone="emerald" />
        <StatCard icon={CalendarClock} label="Outstanding" value={money(fees.outstanding)} hint={`${fees.overdue_count ?? 0} overdue`} tone={fees.outstanding ? "rose" : "emerald"} />
      </div>

      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoice or student…" />
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {canManage ? (
            <>
              <select className="select" value={section} onChange={(event) => setSection(event.target.value)}>
                <option value="">All sections</option>
                {sections.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
              </select>
              <label className="switch">
                <input type="checkbox" checked={overdue} onChange={(event) => setOverdue(event.target.checked)} />
                <span className="track" />
                Overdue only
              </label>
            </>
          ) : null}
          {student ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStudent(""); searchParams.delete("student"); setSearchParams(searchParams, { replace: true }); }}>
              Clear student filter
            </button>
          ) : null}
        </div>

        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Invoice</th><th>Student</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th><th>Due</th><th>Status</th><th className="actions">Actions</th></tr></thead>
                <tbody>
                  {list.rows.map((invoice) => (
                    <tr key={invoice.uuid}>
                      <td>
                        <div className="cell-main">{invoice.invoice_number}</div>
                        <div className="cell-sub">{invoice.title}</div>
                      </td>
                      <td>
                        <div className="cell-user">
                          <Avatar name={invoice.student_name} size="sm" />
                          <div>
                            <div className="cell-main">{invoice.student_name}</div>
                            <div className="cell-sub">{invoice.student_code} · {invoice.class_name || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="num">{money(invoice.amount)}</td>
                      <td className="num">{money(invoice.amount_paid)}</td>
                      <td className="num" style={{ fontWeight: 600, color: Number(invoice.balance) > 0 ? "var(--danger)" : "var(--success)" }}>{money(invoice.balance)}</td>
                      <td className="cell-sub">{formatDate(invoice.due_date)}</td>
                      <td><StatusBadge status={invoice.effective_status || invoice.status} /></td>
                      <td className="actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt(invoice)}><FileText size={13} /> View</button>
                        {!canManage && Number(invoice.balance) > 0 && invoice.status !== "cancelled" ? (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOnlinePaying(invoice)}><CreditCard size={13} /> Pay online</button>
                        ) : null}
                        {canManage && Number(invoice.balance) > 0 && invoice.status !== "cancelled" ? (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setPaying(invoice)}><Wallet size={13} /> Pay</button>
                        ) : null}
                        {canManage ? (
                          <>
                            <button type="button" className="icon-btn" onClick={() => { setEditing(invoice); setFormOpen(true); }} title="Edit invoice"><Pencil size={15} /></button>
                            {invoice.status !== "cancelled" && Number(invoice.amount_paid) === 0 ? (
                              <button type="button" className="icon-btn" onClick={() => cancelInvoice(invoice)} title="Cancel invoice"><Ban size={15} /></button>
                            ) : null}
                            {Number(invoice.amount_paid) === 0 ? (
                              <button type="button" className="icon-btn danger" onClick={() => setDeleting(invoice)} title="Delete invoice"><Trash2 size={15} /></button>
                            ) : null}
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="invoices" />
          </>
        ) : (
          <EmptyState icon={Receipt} title="No invoices found" description={isFamily ? "You have no fee invoices yet." : "Create an invoice or generate them from a fee structure."} />
        )}
      </Card>

      <InvoiceFormModal open={formOpen} onClose={() => setFormOpen(false)} invoice={editing} students={students} onSaved={() => { setFormOpen(false); list.reload(); overview.reload(); }} />
      <PaymentModal invoice={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); list.reload(); overview.reload(); }} />
      <OnlinePaymentModal open={Boolean(onlinePaying)} invoice={onlinePaying} onClose={() => setOnlinePaying(null)} />
      <ReceiptModal receipt={receipt} loading={receiptLoading} onClose={() => setReceipt(null)} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this invoice?" message={`${deleting?.invoice_number} will be removed. Invoices with payments cannot be deleted.`} confirmLabel="Delete invoice" />
    </>
  );
}

function InvoiceFormModal({ open, onClose, invoice, students, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ student: "", title: "", amount: "", due_date: todayISO(), notes: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(invoice ? {
      student: invoice.student,
      title: invoice.title,
      amount: invoice.amount,
      due_date: invoice.due_date,
      notes: invoice.notes || "",
    } : { student: "", title: "", amount: "", due_date: todayISO(), notes: "" });
  }, [open, invoice]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (invoice) await api.patch(`/finance/invoices/${invoice.uuid}/`, payload);
      else await api.post("/finance/invoices/", payload);
      toast.success(invoice ? "Invoice updated." : "Invoice created.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={invoice ? "Edit invoice" : "New invoice"} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="invoice-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="invoice-form" onSubmit={submit}>
        <Field label="Student" required>
          <select className="select" value={form.student} onChange={(event) => setForm((current) => ({ ...current, student: event.target.value }))} required disabled={Boolean(invoice)}>
            <option value="">Select student…</option>
            {students.map((item) => <option key={item.uuid} value={item.uuid}>{item.user?.full_name} — {item.student_id}</option>)}
          </select>
        </Field>
        <Field label="Title" required>
          <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
        </Field>
        <div className="field-row">
          <Field label="Amount" required>
            <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
          </Field>
          <Field label="Due date" required>
            <input className="input" type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} required />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="textarea" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
      </form>
    </Modal>
  );
}

function PaymentModal({ invoice, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setForm({ amount: invoice.balance, method: "cash", reference: "", notes: "" });
    setError(null);
  }, [invoice]);

  if (!invoice) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post(`/finance/invoices/${invoice.uuid}/payments/`, { ...form, amount: Number(form.amount) });
      toast.success(`Payment of ${money(result.payment.amount)} recorded.`, "Payment received");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Record payment" subtitle={`${invoice.invoice_number} · ${invoice.student_name}`} size="modal-sm" footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="payment-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : <Wallet size={15} />} Record payment</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="notice info" style={{ marginBottom: 14 }}>Outstanding balance: <strong>{money(invoice.balance)}</strong></div>
      <form id="payment-form" onSubmit={submit}>
        <Field label="Amount" required>
          <input className="input" type="number" min="0.01" max={invoice.balance} step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
        </Field>
        <Field label="Payment method" required>
          <select className="select" value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}>
            {PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Reference">
          <input className="input" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Transaction or cheque number" />
        </Field>
        <Field label="Notes">
          <input className="input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
      </form>
    </Modal>
  );
}

function ReceiptModal({ receipt, loading, onClose }) {
  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      title="Invoice statement"
      size="modal-lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={loading}><Printer size={15} /> Print</button>
        </>
      }
    >
      {loading ? <Loading /> : receipt ? (
        <div className="receipt">
          <div className="receipt-head">
            <div>
              <h3>{receipt.school || "School ERP"}</h3>
              <p style={{ color: "var(--muted)", fontSize: 12 }}>Official fee statement</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>{receipt.invoice?.invoice_number}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Issued {formatDate(receipt.invoice?.created_at)}</div>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <div>
              <div className="cell-sub" style={{ textTransform: "uppercase", letterSpacing: ".07em", fontSize: 10, fontWeight: 700 }}>Billed to</div>
              <div style={{ fontWeight: 650 }}>{receipt.invoice?.student_name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{receipt.invoice?.student_code} · {receipt.invoice?.class_name || ""} {receipt.invoice?.section_name || ""}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="cell-sub">Due date</div>
              <div style={{ fontWeight: 650 }}>{formatDate(receipt.invoice?.due_date)}</div>
              <StatusBadge status={receipt.invoice?.effective_status || receipt.invoice?.status} />
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>Item</th><th className="num">Amount</th></tr></thead>
              <tbody>
                <tr><td>{receipt.invoice?.title}</td><td className="num">{money(receipt.invoice?.amount)}</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>Payments</div>
            {receipt.payments?.length ? (
              <div className="table-wrap">
                <table className="table table-compact">
                  <thead><tr><th>Receipt</th><th>Method</th><th>Date</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {receipt.payments.map((payment) => (
                      <tr key={payment.uuid}>
                        <td>{payment.receipt_number}</td>
                        <td>{payment.method?.replace("_", " ")}</td>
                        <td className="cell-sub">{formatDateTime(payment.paid_at)}</td>
                        <td className="num">{money(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={{ fontSize: 12, color: "var(--muted)" }}>No payments recorded.</p>}
          </div>

          <div className="receipt-total">
            <span>Balance due</span>
            <span>{money(receipt.invoice?.balance)}</span>
          </div>
          <p className="help" style={{ marginTop: 14 }}>Thank you for your prompt payment. Keep this statement for your records.</p>
        </div>
      ) : <EmptyState icon={Receipt} title="Receipt unavailable" />}
    </Modal>
  );
}
