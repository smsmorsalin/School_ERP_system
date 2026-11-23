import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  FileText,
  Pencil,
  Printer,
  Receipt,
  Wallet,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../lib/usePageTitle";
import { formatDate, formatDateTime, money } from "../lib/format";
import { useFetch, useReferenceData } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  StatCard,
  StatusBadge,
} from "../components/ui";
import { InvoiceFormModal, PaymentModal } from "./Invoices";

/**
 * Invoice statement as its own page: identity, line items, payment history and
 * the record-payment action no longer live inside a modal on the list.
 */
export default function InvoiceDetail() {
  const { uuid } = useParams();
  const { isAdmin, hasRole } = useAuth();
  const canManage = isAdmin || hasRole("Accountant");
  const receiptState = useFetch(`/finance/invoices/${uuid}/receipt/`, { deps: [uuid] });
  const { students } = useReferenceData({ students: canManage });
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const receipt = receiptState.data;
  const invoice = receipt?.invoice;
  usePageTitle(invoice ? invoice.invoice_number : "Invoice");

  const canPay = canManage && invoice && Number(invoice.balance) > 0 && invoice.status !== "cancelled";
  const payments = receipt?.payments || [];

  if (receiptState.loading) {
    return <Loading label="Loading invoice…" />;
  }

  if (receiptState.error) {
    return (
      <>
        <Breadcrumbs items={[{ label: "Invoices", to: "/finance/invoices" }, { label: "Invoice" }]} />
        <ErrorBanner error={receiptState.error} />
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Breadcrumbs items={[{ label: "Invoices", to: "/finance/invoices" }, { label: "Invoice" }]} />
        <Card><EmptyState icon={Receipt} title="Invoice not found" description="It may have been removed or you may not have access." /></Card>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "Invoices", to: "/finance/invoices" }, { label: invoice.invoice_number }]} />
      <PageHeader
        title={invoice.invoice_number}
        subtitle={`${invoice.title} · ${invoice.student_name}`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
            {canManage ? (
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={15} /> Edit
              </button>
            ) : null}
            {canPay ? (
              <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)}>
                <Wallet size={15} /> Record payment
              </button>
            ) : null}
          </>
        }
      />

      <div className="stat-grid">
        <StatCard icon={FileText} label="Invoice amount" value={money(invoice.amount)} hint={invoice.title} tone="indigo" />
        <StatCard icon={Wallet} label="Paid" value={money(invoice.amount_paid)} hint={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} tone="emerald" />
        <StatCard
          icon={CalendarClock}
          label="Balance due"
          value={money(invoice.balance)}
          hint={Number(invoice.balance) > 0 ? "outstanding" : "settled"}
          tone={Number(invoice.balance) > 0 ? "rose" : "emerald"}
        />
        <StatCard icon={CalendarDays} label="Due date" value={formatDate(invoice.due_date)} hint={`issued ${formatDate(invoice.created_at)}`} tone="amber" />
      </div>

      <div className="detail-grid detail-block">
        <Card title="Billed to" subtitle="Student this invoice belongs to">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Avatar name={invoice.student_name} size="lg" />
            <div>
              <div style={{ fontWeight: 650, fontSize: 15 }}>{invoice.student_name}</div>
              <div className="cell-sub">{invoice.student_code}{invoice.class_name ? ` · ${invoice.class_name}` : ""}{invoice.section_name ? ` · ${invoice.section_name}` : ""}</div>
            </div>
          </div>
          <dl className="kv">
            <dt>Status</dt><dd><StatusBadge status={invoice.effective_status || invoice.status} /></dd>
            <dt>Class</dt><dd>{invoice.class_name || "—"}</dd>
            <dt>Section</dt><dd>{invoice.section_name || "—"}</dd>
          </dl>
          {canManage && invoice.student ? (
            <p style={{ marginTop: 12 }}>
              <Link to={`/students/${invoice.student}`}>View student record</Link>
            </p>
          ) : null}
        </Card>

        <Card title="Invoice details" subtitle="Billing item and payment terms">
          <dl className="kv">
            <dt>Item</dt><dd>{invoice.title}</dd>
            <dt>Invoice no.</dt><dd>{invoice.invoice_number}</dd>
            <dt>Issued</dt><dd>{formatDate(invoice.created_at)}</dd>
            <dt>Due date</dt><dd>{formatDate(invoice.due_date)}</dd>
            <dt>Amount</dt><dd>{money(invoice.amount)}</dd>
            <dt>Balance</dt><dd style={{ fontWeight: 600, color: Number(invoice.balance) > 0 ? "var(--danger)" : "var(--success)" }}>{money(invoice.balance)}</dd>
            {invoice.notes ? <><dt>Notes</dt><dd>{invoice.notes}</dd></> : null}
          </dl>
        </Card>
      </div>

      <Card
        flush
        title="Payment history"
        subtitle="Receipts recorded against this invoice"
        actions={<Badge tone="neutral">{payments.length} payment{payments.length === 1 ? "" : "s"}</Badge>}
      >
        {payments.length ? (
          <>
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Receipt</th><th>Method</th><th>Date</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.uuid}>
                      <td>
                        <div className="cell-main">{payment.receipt_number}</div>
                        {payment.reference ? <div className="cell-sub">{payment.reference}</div> : null}
                      </td>
                      <td>{payment.method?.replace("_", " ")}</td>
                      <td className="cell-sub">{formatDateTime(payment.paid_at)}</td>
                      <td className="num">{money(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="receipt-total" style={{ margin: "0 18px 16px" }}>
              <span>Balance due</span>
              <span>{money(invoice.balance)}</span>
            </div>
          </>
        ) : (
          <EmptyState icon={Wallet} title="No payments recorded" description={canPay ? "Use “Record payment” to add the first receipt." : "This invoice has not been paid yet."} />
        )}
      </Card>

      <p className="help" style={{ marginTop: 14 }}>
        Thank you for your prompt payment. Keep this statement for your records.
      </p>

      <PaymentModal
        invoice={payOpen ? invoice : null}
        onClose={() => setPayOpen(false)}
        onSaved={() => { setPayOpen(false); receiptState.reload(); }}
      />
      <InvoiceFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        invoice={invoice}
        students={students}
        onSaved={() => { setEditOpen(false); receiptState.reload(); }}
      />
    </>
  );
}
