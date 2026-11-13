import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  Lock,
  Receipt,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDateTime, money } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  Spinner,
  StatusBadge,
} from "../components/ui";

const INTENT = (uuid) => `/finance/payment-intents/${uuid}/`;

function GatewayMark({ intent }) {
  if (!intent) return null;
  const initial = intent.gateway === "bkash" ? "bK"
    : intent.gateway === "nagad" ? "Na"
    : intent.gateway === "rocket" ? "Ro"
    : intent.gateway === "card" ? "CC"
    : intent.gateway === "bank" ? "BK"
    : "MB";
  return (
    <span
      className="gateway-logo gateway-logo-lg"
      style={{ background: intent.gateway_brand_color || "var(--primary)" }}
    >
      {initial}
    </span>
  );
}

export default function Checkout() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  usePageTitle("Secure checkout");

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const data = await api.get(INTENT(uuid));
        if (id === requestId.current) {
          setIntent(data);
          setError(null);
        }
      } catch (err) {
        if (id === requestId.current) {
          setError(err);
          if (!silent) setIntent(null);
        }
      } finally {
        if (id === requestId.current && !silent) setLoading(false);
      }
    },
    [uuid]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!intent || intent.status !== "pending") return undefined;
    const timer = window.setInterval(() => load(true), 3000);
    return () => window.clearInterval(timer);
  }, [intent?.status, load]);

  const confirm = async (outcome) => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.post(`${INTENT(uuid)}sandbox-confirm/`, { outcome });
      setIntent(data);
      if (data.status === "succeeded") {
        toast.success("Payment confirmed. Your invoice is now paid.", "Payment successful");
      } else {
        toast.error(data.failure_reason || "The sandbox payment was declined.");
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      setIntent(await api.post(`${INTENT(uuid)}cancel/`, {}));
      toast.success("Checkout cancelled. No payment was taken.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !intent) {
    return (
      <div className="checkout-shell">
        <Loading label="Loading secure checkout…" />
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="checkout-shell">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <Card>
          <EmptyState
            icon={Receipt}
            title="Checkout not found"
            description="This payment session does not exist or is not available to your account."
            action={
              <Link to="/invoices" className="btn btn-primary" style={{ textDecoration: "none" }}>
                <ArrowLeft size={15} /> Back to invoices
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const isPending = intent.status === "pending";
  const isSucceeded = intent.status === "succeeded";

  return (
    <div className="checkout-shell">
      <div className="checkout-topbar">
        <Link to="/invoices" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back to invoices
        </Link>
        <span className="secure-pill"><Lock size={13} /> Secure checkout</span>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className={`checkout-card ${isSucceeded ? "checkout-card-success" : ""}`}>
        <div className="checkout-head">
          <div className="checkout-gateway">
            <GatewayMark intent={intent} />
            <div>
              <span className="cell-sub">Paying with</span>
              <h3>{intent.gateway_label || intent.gateway}</h3>
            </div>
          </div>
          <StatusBadge status={intent.status} />
        </div>

        <div className="checkout-amount">
          <span>Amount due now</span>
          <strong>{money(intent.amount)}</strong>
          <small>{intent.currency} · {intent.intent_number}</small>
        </div>

        <div className="checkout-invoice">
          <div>
            <span className="cell-sub">Invoice</span>
            <strong>{intent.invoice?.invoice_number}</strong>
            <small>{intent.invoice?.title}</small>
          </div>
          <div>
            <span className="cell-sub">Student</span>
            <strong>{intent.invoice?.student_name}</strong>
            <small>{intent.invoice?.student_code}</small>
          </div>
          <div>
            <span className="cell-sub">Outstanding after</span>
            <strong>
              {money(
                isSucceeded
                  ? Number(intent.invoice?.balance || 0)
                  : Math.max(
                      Number(intent.invoice?.balance || 0) -
                        Number(intent.amount || 0),
                      0
                    )
              )}
            </strong>
            <small>{isSucceeded ? "Invoice updated" : "If this payment succeeds"}</small>
          </div>
        </div>

        {isPending ? (
          <>
            {intent.sandbox ? (
              <div className="sandbox-panel">
                <div className="sandbox-head">
                  <ShieldCheck size={19} />
                  <div>
                    <strong>Sandbox payment page</strong>
                    <span>
                      This checkout simulates the {intent.gateway_label} hosted page.
                      No real money will be charged.
                    </span>
                  </div>
                </div>
                <div className="sandbox-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => confirm("succeeded")}
                    disabled={busy}
                  >
                    {busy ? <Spinner size={15} light /> : <CreditCard size={15} />}
                    Pay {money(intent.amount)} in sandbox
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => confirm("failed")}
                    disabled={busy}
                  >
                    Simulate decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="notice info checkout-wait">
                <Clock3 size={18} />
                <span>
                  Complete the payment on the provider's secure page. This screen
                  updates automatically when confirmation arrives.
                </span>
                {intent.checkout_url ? (
                  <a className="btn btn-primary btn-sm" href={intent.checkout_url}>
                    Open payment page
                  </a>
                ) : null}
              </div>
            )}

            <div className="checkout-meta">
              <span><Clock3 size={13} /> Session expires {formatDateTime(intent.expires_at)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>
                Cancel checkout
              </button>
            </div>
          </>
        ) : null}

        {isSucceeded ? (
          <div className="checkout-result success">
            <CheckCircle2 size={34} />
            <div>
              <h3>Payment received</h3>
              <p>
                Your payment has been verified and applied to invoice{" "}
                <strong>{intent.invoice?.invoice_number}</strong>.
              </p>
              <div className="result-meta">
                <span>Receipt <strong>{intent.payment?.receipt_number || "—"}</strong></span>
                <span>Method <strong>{intent.payment?.method?.replace("_", " ") || intent.gateway_label}</strong></span>
                <span>Paid <strong>{formatDateTime(intent.completed_at)}</strong></span>
              </div>
            </div>
          </div>
        ) : null}

        {!isPending && !isSucceeded ? (
          <div className="checkout-result failed">
            <XCircle size={34} />
            <div>
              <h3>Payment not completed</h3>
              <p>{intent.failure_reason || `This checkout is ${intent.status}.`}</p>
              <p className="help">No money was added to the invoice. You can start a new checkout.</p>
            </div>
          </div>
        ) : null}

        <div className="checkout-actions">
          {isSucceeded ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => navigate("/invoices")}>
                Back to invoices
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => load()}>
                Refresh
              </button>
            </>
          ) : null}
          {!isPending && !isSucceeded ? (
            <button type="button" className="btn btn-primary" onClick={() => navigate("/invoices")}>
              Try again from invoices
            </button>
          ) : null}
        </div>

        <div className="secure-note checkout-secure">
          <Lock size={16} />
          <span>
            School ERP never stores card numbers, PINs, OTPs or mobile-banking
            passwords. Only the gateway's transaction reference and a masked
            account reference are kept for reconciliation.
          </span>
        </div>

        <div className="checkout-footnote">
          <Badge tone="blue">PCI-aware</Badge>
          <Badge tone="green">HMAC-verified</Badge>
          <span>Payments are confirmed server-side before the ledger changes.</span>
        </div>
      </div>
    </div>
  );
}
