export const CURRENCY = "$";

export function money(value, opts = {}) {
  const number = Number(value ?? 0);
  return `${CURRENCY}${number.toLocaleString(undefined, {
    minimumFractionDigits: opts.decimals ?? 2,
    maximumFractionDigits: opts.decimals ?? 2,
  })}`;
}

export function compactMoney(value) {
  const number = Number(value ?? 0);
  if (Math.abs(number) >= 1_000_000) return `${CURRENCY}${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `${CURRENCY}${(number / 1_000).toFixed(1)}k`;
  return money(number, { decimals: 0 });
}

export function number(value) {
  return Number(value ?? 0).toLocaleString();
}

export function percent(value, digits = 1) {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function fullName(user) {
  if (!user) return "—";
  if (user.full_name) return user.full_name;
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "—";
}

export function formatDate(value, opts = {}) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date)} · ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatTime(value) {
  if (!value) return "—";
  const [hours, minutes] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function relativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function titleCase(value) {
  if (!value) return "";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusTone(status) {
  const map = {
    active: "green",
    present: "green",
    paid: "green",
    success: "green",
    published: "green",
    partial: "amber",
    late: "amber",
    pending: "amber",
    unpaid: "amber",
    excused: "blue",
    logout: "neutral",
    cancelled: "red",
    absent: "red",
    failed: "red",
    overdue: "red",
    suspended: "red",
    graduated: "violet",
    transferred: "neutral",
  };
  return map[status] || "neutral";
}

export function gradeTone(grade) {
  if (!grade) return "neutral";
  if (grade.startsWith("A")) return "green";
  if (grade.startsWith("B")) return "blue";
  if (grade.startsWith("C")) return "amber";
  if (grade === "D") return "amber";
  return "red";
}

export function downloadCSV(filename, rows, headers) {
  const escape = (cell) => {
    const text = cell === null || cell === undefined ? "" : String(cell);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [];
  if (headers) lines.push(headers.map(escape).join(","));
  rows.forEach((row) => lines.push(row.map(escape).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
