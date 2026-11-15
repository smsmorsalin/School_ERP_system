import { useEffect, useState } from "react";
import { Activity, Download, Filter, ShieldCheck } from "lucide-react";
import { downloadCSV, formatDateTime } from "../lib/format";
import { useList } from "../lib/hooks";
import { usePageTitle } from "../lib/usePageTitle";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";

const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "finance", label: "Finance" },
  { value: "accounts", label: "Accounts" },
  { value: "academics", label: "Academics" },
  { value: "attendance", label: "Attendance" },
  { value: "exams", label: "Examinations" },
  { value: "communication", label: "Communication" },
  { value: "audit", label: "Audit" },
];

function actionTone(action) {
  if (String(action).includes(".deleted") || String(action).includes("cancelled")) return "red";
  if (String(action).includes(".created") || String(action).includes("recorded")) return "green";
  if (String(action).includes(".updated")) return "amber";
  return "neutral";
}

function shortUuid(value) {
  return value ? `${String(value).slice(0, 8)}…` : "—";
}

export default function Audit() {
  usePageTitle("Audit Log");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const list = useList("/audit/", { ordering: "-created_at" }, { pageSize: 25 });

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    list.update({ action_category: category, search: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, debounced]);

  const exportRows = () => {
    downloadCSV(
      "audit-log.csv",
      list.rows.map((row) => [
        row.created_at,
        row.actor_email,
        row.action,
        row.action_category,
        row.target_app,
        row.target_model,
        row.target_uuid,
        row.ip_address,
      ]),
      ["Time", "Actor", "Action", "Category", "Target app", "Target model", "Target UUID", "IP"]
    );
  };

  const hasFilters = category || debounced;

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Immutable trail of sensitive actions across the system"
        actions={
          <button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}>
            <Download size={16} /> Export
          </button>
        }
      />

      <ErrorBanner error={list.error} onDismiss={() => list.update({ page: list.page })} />

      <Card
        title="Recorded events"
        subtitle={`${list.count} entr${list.count === 1 ? "y" : "ies"} · most recent first`}
        flush
      >
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <div className="input-wrap" style={{ flex: 1, minWidth: 200 }}>
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actor, action, target or IP…"
            />
          </div>
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          {hasFilters ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCategory(""); setSearch(""); }}>
              Clear
            </button>
          ) : null}
        </div>

        {list.loading ? (
          <Loading />
        ) : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((row) => (
                    <tr key={row.uuid}>
                      <td className="cell-sub">{formatDateTime(row.created_at)}</td>
                      <td className="cell-main">{row.actor_email || "system"}</td>
                      <td>
                        <Badge tone={actionTone(row.action)}>{row.action}</Badge>
                        {row.action_category ? (
                          <div className="cell-sub" style={{ marginTop: 3 }}>{row.action_category}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="cell-main">{row.target_model || "—"}</div>
                        <div className="cell-sub">{row.target_repr || shortUuid(row.target_uuid)}</div>
                      </td>
                      <td className="cell-sub">{row.ip_address || "—"}</td>
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
              label="events"
            />
          </>
        ) : (
          <EmptyState
            icon={hasFilters ? Filter : Activity}
            title={hasFilters ? "No matching events" : "No audit events yet"}
            description={
              hasFilters
                ? "Try a different category or search term."
                : "Sensitive actions will appear here as staff use the system."
            }
          />
        )}
      </Card>

      <div className="notice info" style={{ marginTop: 16 }}>
        <ShieldCheck />
        <span>
          Audit entries are append-only and cannot be edited or deleted, preserving a
          tamper-evident history for compliance and incident review.
        </span>
      </div>
    </>
  );
}
