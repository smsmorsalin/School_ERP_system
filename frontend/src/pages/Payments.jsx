import { useEffect, useMemo, useState } from "react";
import { Banknote, Download, Filter, Plus, Receipt, TrendingUp } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { downloadCSV, formatDateTime, money } from "../lib/format";
import { PAYMENT_METHODS } from "../lib/constants";
import { useAll, useFetch, useList } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Spinner,
  StatCard,
  StatusBadge,
} from "../components/ui";
import { AreaChart, DonutChart, palette } from "../components/charts";

export default function Payments() {
  const toast = useToast();
  const [method, setMethod] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const list = useList("/finance/payments/", { ordering: "-paid_at" });
  const summary = useFetch("/finance/payments/summary/?days=365", { deps: [] });

  useEffect(() => {
    list.update({ method, paid_from: paidFrom ? `${paidFrom}T00:00:00` : "", paid_to: paidTo ? `${paidTo}T23:59:59` : "", page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, paidFrom, paidTo]);

  const totals = summary.data || {};
  const byMethod = (totals.by_method || []).map((row, index) => ({
    label: row.method?.replace("_", " ") || "Other",
    value: Number(row.total),
    color: palette[index % palette.length],
  }));
  const monthly = (totals.monthly || []).map((row) => ({
    label: row.month || "",
    value: Number(row.total),
  }));

  const exportRows = () => {
    downloadCSV(
      "payments.csv",
      list.rows.map((row) => [row.receipt_number, row.student_name, row.invoice_number, row.method, row.amount, row.paid_at]),
      ["Receipt", "Student", "Invoice", "Method", "Amount", "Paid at"]
    );
  };

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Fee collections, methods and receipts"
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}><Download size={16} /> Export</button>
            <button type="button" className="btn btn-primary" onClick={() => setRecordOpen(true)}><Plus size={16} /> Record payment</button>
          </>
        }
      />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <StatCard icon={Banknote} label="Total collected" value={money(totals.total_collected)} hint="last 12 months" tone="emerald" />
        <StatCard icon={Receipt} label="Payments" value={totals.payment_count ?? 0} hint="transactions" tone="indigo" />
        <StatCard icon={TrendingUp} label="Methods used" value={byMethod.length} hint="payment channels" tone="cyan" />
      </div>

      <div className="grid-2">
        <Card title="Collection trend" subtitle="Monthly totals · last 12 months">
          {summary.loading ? <Loading /> : monthly.length ? <AreaChart data={monthly} color="#10b981" formatValue={(value) => money(value, { decimals: 0 })} height={230} /> : <EmptyState icon={Banknote} title="No payments yet" />}
        </Card>
        <Card title="By payment method" subtitle="Share of collections">
          {summary.loading ? <Loading /> : byMethod.length ? <DonutChart data={byMethod} centerLabel="Collected" centerValue={money(totals.total_collected, { decimals: 0 })} /> : <EmptyState icon={Receipt} title="No payment data" />}
        </Card>
      </div>

      <Card title="Payment history" subtitle={`${list.count} transaction(s)`} style={{ marginTop: 20 }} flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <select className="select" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input className="input" type="date" value={paidFrom} onChange={(event) => setPaidFrom(event.target.value)} title="From date" />
          <input className="input" type="date" value={paidTo} onChange={(event) => setPaidTo(event.target.value)} title="To date" />
          {(method || paidFrom || paidTo) ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMethod(""); setPaidFrom(""); setPaidTo(""); }}>Clear</button>
          ) : null}
        </div>

        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Receipt</th><th>Student</th><th>Invoice</th><th>Method</th><th className="num">Amount</th><th>Paid</th><th>Received by</th></tr></thead>
                <tbody>
                  {list.rows.map((payment) => (
                    <tr key={payment.uuid}>
                      <td className="cell-main">{payment.receipt_number}</td>
                      <td>
                        <div className="cell-user">
                          <Avatar name={payment.student_name} size="sm" />
                          <span>{payment.student_name}</span>
                        </div>
                      </td>
                      <td className="cell-sub">{payment.invoice_number}</td>
                      <td><StatusBadge status={payment.method} /></td>
                      <td className="num cell-main">{money(payment.amount)}</td>
                      <td className="cell-sub">{formatDateTime(payment.paid_at)}</td>
                      <td className="cell-sub">{payment.received_by_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="payments" />
          </>
        ) : <EmptyState icon={Banknote} title="No payments found" description="Try changing the filters or record a payment." />}
      </Card>

      <RecordPaymentModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onSaved={() => { setRecordOpen(false); list.reload(); summary.reload(); }}
      />
    </>
  );
}

function RecordPaymentModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const { data: invoices } = useAll("/finance/invoices/", { status: "unpaid", ordering: "due_date" }, { enabled: open });
  const { data: partials } = useAll("/finance/invoices/", { status: "partial", ordering: "due_date" }, { enabled: open });
  const options = useMemo(() => [...invoices, ...partials], [invoices, partials]);
  const [invoiceUuid, setInvoiceUuid] = useState("");
  const [form, setForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const invoice = options.find((item) => item.uuid === invoiceUuid);

  useEffect(() => {
    if (!open) return;
    setInvoiceUuid("");
    setForm({ amount: "", method: "cash", reference: "", notes: "" });
    setError(null);
  }, [open]);

  useEffect(() => {
    if (invoice) setForm((current) => ({ ...current, amount: invoice.balance }));
  }, [invoice]);

  const submit = async (event) => {
    event.preventDefault();
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post(`/finance/invoices/${invoice.uuid}/payments/`, { ...form, amount: Number(form.amount) });
      toast.success(`${money(result.payment.amount)} recorded for ${invoice.student_name}.`, "Payment received");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record a payment" subtitle="Select an outstanding invoice and enter the amount received." footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="record-payment-form" className="btn btn-primary" disabled={busy || !invoice}>
          {busy ? <Spinner size={15} light /> : <Banknote size={15} />} Record payment
        </button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="record-payment-form" onSubmit={submit}>
        <Field label="Outstanding invoice" required>
          <select className="select" value={invoiceUuid} onChange={(event) => setInvoiceUuid(event.target.value)} required>
            <option value="">Select invoice…</option>
            {options.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.invoice_number} · {item.student_name} · {money(item.balance)} due
              </option>
            ))}
          </select>
        </Field>
        {invoice ? (
          <div className="notice info" style={{ marginBottom: 14 }}>
            {invoice.title} · outstanding <strong>{money(invoice.balance)}</strong>
          </div>
        ) : null}
        <div className="field-row">
          <Field label="Amount" required>
            <input className="input" type="number" min="0.01" max={invoice?.balance || undefined} step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required disabled={!invoice} />
          </Field>
          <Field label="Method" required>
            <select className="select" value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}>
              {PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Reference">
          <input className="input" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} />
        </Field>
        <Field label="Notes">
          <input className="input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
      </form>
      {!options.length ? <EmptyState icon={Receipt} title="No outstanding invoices" description="All invoices are fully paid or none exist." /> : null}
    </Modal>
  );
}
