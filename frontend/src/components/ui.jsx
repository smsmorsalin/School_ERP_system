import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { initials } from "../lib/format";

export function Avatar({ name, src, size = "md", className = "" }) {
  return (
    <span className={`avatar avatar-${size} ${className}`} title={name || ""}>
      {src ? <img src={src} alt={name || "Profile"} /> : initials(name)}
    </span>
  );
}

export function Badge({ tone = "neutral", children, dot = false, className = "" }) {
  return (
    <span className={`badge badge-${tone} ${dot ? "badge-dot" : ""} ${className}`}>
      {children}
    </span>
  );
}

const ROLE_TONE = {
  Admin: "violet",
  Teacher: "indigo",
  Accountant: "cyan",
  Parent: "amber",
  Student: "green",
};

export function RoleBadge({ role }) {
  return <Badge tone={ROLE_TONE[role] || "neutral"}>{role}</Badge>;
}

export function RoleBadges({ roles = [] }) {
  if (!roles.length) return <span className="cell-sub">No role</span>;
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {roles.map((role) => (
        <RoleBadge role={role} key={role} />
      ))}
    </span>
  );
}

const STATUS_TONE = {
  active: "green",
  present: "green",
  paid: "green",
  success: "green",
  succeeded: "green",
  published: "green",
  partial: "amber",
  late: "amber",
  unpaid: "amber",
  pending: "amber",
  excused: "blue",
  cancelled: "red",
  absent: "red",
  failed: "red",
  overdue: "red",
  suspended: "red",
  graduated: "violet",
  transferred: "neutral",
  expired: "neutral",
  logout: "neutral",
};

const STATUS_LABEL = {
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
  first_term: "First Term",
  mid_term: "Mid Term",
  final_term: "Final Term",
  full_time: "Full time",
  part_time: "Part time",
};

export function labelize(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (STATUS_LABEL[value]) return STATUS_LABEL[value];
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StatusBadge({ status, children }) {
  if (!status) return <span className="cell-sub">—</span>;
  return (
    <Badge tone={STATUS_TONE[status] || "neutral"} dot>
      {children || labelize(status)}
    </Badge>
  );
}

export function Spinner({ light = false, size = 22 }) {
  return (
    <span
      className={`spinner ${light ? "light" : ""}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="loading-block">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title = "Nothing here yet", description, action }) {
  const Icon = icon || Inbox;
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={24} />
      </div>
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClass = "",
  flush = false,
  footer,
}) {
  return (
    <section className={`card ${className}`}>
      {title || actions ? (
        <div className="card-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8 }}>{actions}</div> : null}
        </div>
      ) : null}
      <div className={`card-body ${flush ? "flush" : ""} ${bodyClass}`}>{children}</div>
      {footer ? <div className="card-footer">{footer}</div> : null}
    </section>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = "indigo" }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{Icon ? <Icon /> : null}</div>
      <div className="stat-body">
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, required, hint, error, children, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label ? (
        <label>
          {label}
          {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="error-text">{error}</div> : null}
      {hint && !error ? <div className="help">{hint}</div> : null}
    </div>
  );
}

export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  const message = typeof error === "string" ? error : error.message;
  return (
    <div className="form-error" role="alert" style={{ display: "flex", gap: 8 }}>
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="icon-btn"
          style={{ marginLeft: "auto", width: 22, height: 22 }}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "",
  closeOnOverlay = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (closeOnOverlay && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="modal-sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-${tone}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner size={16} light /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: "var(--text-2)", fontSize: 13.5 }}>{message}</p>
    </Modal>
  );
}

export function Pagination({ page, totalPages, count, onPage, label = "records" }) {
  if (!count) return null;
  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let index = start; index <= end; index += 1) pages.push(index);

  return (
    <div className="pagination">
      <span>
        Page <strong>{page}</strong> of <strong>{totalPages}</strong> · {count} {label}
      </span>
      <div className="pages">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        {start > 1 ? (
          <>
            <button type="button" onClick={() => onPage(1)}>
              1
            </button>
            {start > 2 ? <span style={{ padding: "0 4px" }}>…</span> : null}
          </>
        ) : null}
        {pages.map((item) => (
          <button
            type="button"
            key={item}
            className={item === page ? "active" : ""}
            onClick={() => onPage(item)}
          >
            {item}
          </button>
        ))}
        {end < totalPages ? (
          <>
            {end < totalPages - 1 ? <span style={{ padding: "0 4px" }}>…</span> : null}
            <button type="button" onClick={() => onPage(totalPages)}>
              {totalPages}
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          key={tab.value}
          className={`tab ${value === tab.value ? "active" : ""}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange?.(event.target.checked)}
        disabled={disabled}
      />
      <span className="track" />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="input-wrap" style={{ position: "relative" }}>
      <Search
        size={16}
        style={{
          position: "absolute",
          left: 11,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--muted)",
          pointerEvents: "none",
        }}
      />
      <input
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: 34, width: 250, maxWidth: "100%" }}
        aria-label={placeholder}
      />
    </div>
  );
}

export function ProgressBar({ value, tone = "" }) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className={`progress ${tone}`}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function SelectOptions({ options, placeholder }) {
  return (
    <>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </>
  );
}

export function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        color: "var(--text-2)",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
          background: checked ? "var(--primary)" : "#fff",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {checked ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange?.(event.target.checked)}
        disabled={disabled}
        style={{ display: "none" }}
      />
      {label}
    </label>
  );
}

export function Notice({ tone = "info", icon: Icon = AlertCircle, children }) {
  return (
    <div className={`notice ${tone}`}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}

export function InlineLoader() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
      <Loader2 size={15} style={{ animation: "spin 0.7s linear infinite" }} />
    </span>
  );
}
