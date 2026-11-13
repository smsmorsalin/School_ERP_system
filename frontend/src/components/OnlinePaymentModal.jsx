import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Lock, ShieldCheck, Wallet } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { money } from "../lib/format";
import {
  PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY_GROUPS,
} from "../lib/constants";
import { ErrorBanner, Field, Modal, Spinner } from "./ui";

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return `pay-${window.crypto.randomUUID()}`;
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function OnlinePaymentModal({ invoice, open, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState(null);
  const [gateway, setGateway] = useState("bkash");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingGateways, setLoadingGateways] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    if (!open || !invoice) return;
    setError(null);
    setGateway("bkash");
    setAmount(invoice.balance);
    idempotencyKey.current = newIdempotencyKey();
    setLoadingGateways(true);
    api
      .get("/finance/payment-gateways/")
      .then((data) => setCatalogue(data))
      .catch((err) => setError(err))
      .finally(() => setLoadingGateways(false));
  }, [open, invoice]);

  const gateways = catalogue?.gateways?.length
    ? catalogue.gateways
    : PAYMENT_GATEWAYS;
  const groups = useMemo(
    () =>
      PAYMENT_GATEWAY_GROUPS.map((group) => ({
        ...group,
        gateways: gateways.filter((item) => item.category === group.category),
      })).filter((group) => group.gateways.length),
    [gateways]
  );
  const selected = gateways.find((item) => item.code === gateway) || gateways[0];
  const onlineEnabled = catalogue ? catalogue.enabled !== false : true;
  const sandbox = Boolean(catalogue?.sandbox);
  const balance = Number(invoice?.balance || 0);

  if (!invoice) return null;

  const submit = async (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!onlineEnabled) {
      setError("Online payments are currently unavailable. Please contact the school.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (value > balance) {
      setError(`The amount cannot exceed the outstanding balance of ${money(balance)}.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const intent = await api.post(
        "/finance/payment-intents/",
        {
          invoice: invoice.uuid,
          gateway,
          amount: value.toFixed(2),
        },
        { headers: { "Idempotency-Key": idempotencyKey.current } }
      );

      const target = intent.checkout_url || `/checkout/${intent.uuid}`;
      if (intent.sandbox || target.includes("/checkout/")) {
        navigate(new URL(target, window.location.origin).pathname);
        onClose();
      } else {
        toast.success("Redirecting to the secure payment page…");
        window.location.assign(target);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pay fees online"
      subtitle={`${invoice.invoice_number} · ${invoice.student_name}`}
      size="modal-lg"
      closeOnOverlay={!busy}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            form="online-payment-form"
            className="btn btn-primary"
            disabled={busy || !onlineEnabled || loadingGateways}
          >
            {busy ? <Spinner size={15} light /> : <Lock size={15} />}
            Continue to {selected?.label || "payment"}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {catalogue && !onlineEnabled ? (
        <div className="notice danger" style={{ marginBottom: 14 }}>
          <AlertCircle />
          <span>Online fee payments are disabled by the school right now.</span>
        </div>
      ) : null}
      {sandbox ? (
        <div className="notice warning" style={{ marginBottom: 14 }}>
          <ShieldCheck />
          <span>
            <strong>Sandbox checkout.</strong> This is a safe demonstration; no real
            money will be charged.
          </span>
        </div>
      ) : null}

      <div className="online-pay-summary">
        <div>
          <span className="cell-sub">Outstanding balance</span>
          <strong>{money(invoice.balance)}</strong>
        </div>
        <div>
          <span className="cell-sub">Due date</span>
          <strong>{invoice.due_date || "—"}</strong>
        </div>
        <div>
          <span className="cell-sub">Student</span>
          <strong>{invoice.student_name}</strong>
        </div>
      </div>

      <form id="online-payment-form" onSubmit={submit}>
        <Field
          label="Amount to pay"
          required
          hint={`You can pay part of the bill. Maximum ${money(balance)}.`}
        >
          <div className="input-wrap">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="1"
              max={balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <span className="input-icon input-suffix">BDT</span>
          </div>
        </Field>

        <div className="field">
          <label>Payment method<span className="req">*</span></label>
          {loadingGateways ? (
            <div className="loading-inline"><Spinner size={16} /> Loading payment methods…</div>
          ) : (
            groups.map((group) => (
              <div className="gateway-group" key={group.category}>
                <div className="gateway-group-head">
                  <strong>{group.label}</strong>
                  <span>{group.hint}</span>
                </div>
                <div className="gateway-grid">
                  {group.gateways.map((item) => (
                    <button
                      type="button"
                      key={item.code}
                      className={`gateway-card ${gateway === item.code ? "selected" : ""}`}
                      onClick={() => setGateway(item.code)}
                      aria-pressed={gateway === item.code}
                    >
                      <span
                        className="gateway-logo"
                        style={{ background: item.brand_color || "var(--primary)" }}
                      >
                        {item.initials || item.label?.slice(0, 2)}
                      </span>
                      <span className="gateway-copy">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <span className="gateway-radio" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="secure-note">
          <Lock size={16} />
          <span>
            You will continue to the {selected?.label || "provider"} hosted checkout.
            The school never asks for or stores card numbers, PINs, OTPs or mobile
            banking passwords.
          </span>
        </div>
      </form>

      <div className="checkout-footnote">
        <Wallet size={15} />
        Payments are verified by the gateway before your invoice is marked paid.
      </div>
    </Modal>
  );
}
