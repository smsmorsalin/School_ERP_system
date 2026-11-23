import { useEffect, useState } from "react";
import { CalendarCheck, CheckCheck, ClipboardCheck, Trash2, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { formatDate, percent } from "../../lib/format";
import { ATTENDANCE_STATUSES } from "../../lib/constants";
import { useDebounced, useFetch, useList, useReferenceData } from "../../lib/hooks";
import {
  Avatar,
  Card,
  ConfirmDialog,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  StatCard,
  StatusBadge,
  Toolbar,
} from "../../components/ui";
import { AreaChart } from "../../components/charts";

const STATUS_BUTTONS = ATTENDANCE_STATUSES;

/** Records are an analysis surface: trends first, then the raw register. */
export default function RecordsPage() {
  usePageTitle("Attendance records");
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { sections } = useReferenceData({ sections: true });
  const list = useList("/attendance/", { ordering: "-date" });
  const summary = useFetch(`/attendance/summary/?days=30${section ? `&section=${section}` : ""}`, {
    deps: [section],
  });

  useEffect(() => {
    list.update({ section, status, date_from: dateFrom, date_to: dateTo, search: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, status, dateFrom, dateTo, debounced]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/attendance/${deleting.uuid}/`);
      toast.success("Attendance record removed.");
      setDeleting(null);
      list.reload();
      summary.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const totals = summary.data?.totals || {};
  const daily = (summary.data?.daily || []).map((row) => ({
    label: new Date(row.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    value: row.rate,
  }));

  const hasFilters = section || status || dateFrom || dateTo || search;

  return (
    <>
      <PageHeader
        title="Records & trends"
        subtitle="Review attendance history, spot patterns and correct mistakes."
      />

      <div className="stat-grid">
        <StatCard
          icon={CalendarCheck}
          label="Attendance rate"
          value={percent(totals.attendance_rate)}
          hint="last 30 days"
          tone="emerald"
        />
        <StatCard
          icon={CheckCheck}
          label="Present"
          value={totals.present ?? 0}
          hint={`${totals.late ?? 0} late arrivals`}
          tone="indigo"
        />
        <StatCard
          icon={Users}
          label="Absent"
          value={totals.absent ?? 0}
          hint={`${totals.excused ?? 0} excused`}
          tone="rose"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Records"
          value={totals.total ?? 0}
          hint="last 30 days"
          tone="cyan"
        />
      </div>

      <Card title="Attendance trend" subtitle="Daily present rate · last 30 days">
        {summary.loading ? (
          <Loading />
        ) : daily.length ? (
          <AreaChart data={daily} color="#17613d" formatValue={(value) => `${Math.round(value)}%`} height={220} />
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance data"
            description="Records will appear once attendance is marked."
          />
        )}
      </Card>

      <Card title="Register history" subtitle={`${list.count} record(s)`} style={{ marginTop: 20 }} flush>
        <Toolbar
          meta={
            hasFilters ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSection("");
                  setStatus("");
                  setDateFrom("");
                  setDateTo("");
                  setSearch("");
                }}
              >
                Clear filters
              </button>
            ) : (
              <span>{list.count} records</span>
            )
          }
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search student…" />
          <select className="select" aria-label="Filter by section" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {sections.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.display_name}
              </option>
            ))}
          </select>
          <select className="select" aria-label="Filter by attendance status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUS_BUTTONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} title="From date" />
          <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} title="To date" />
        </Toolbar>

        {list.loading ? (
          <Loading />
        ) : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Section</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Marked by</th>
                    {isAdmin ? <th className="actions">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((record) => (
                    <tr key={record.uuid}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={record.student_name} size="sm" />
                          <div>
                            <div className="cell-main">{record.student_name}</div>
                            <div className="cell-sub">{record.student_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>{record.section_name}</td>
                      <td className="num">{formatDate(record.date)}</td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="cell-sub">{record.remarks || "—"}</td>
                      <td className="cell-sub">{record.marked_by_name || "—"}</td>
                      {isAdmin ? (
                        <td className="actions">
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label="Delete attendance record"
                            onClick={() => setDeleting(record)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      ) : null}
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
              label="records"
            />
          </>
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records"
            description={hasFilters ? "Try changing or clearing the filters." : "Mark attendance to start building history."}
          />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete this record?"
        message={`Attendance for ${deleting?.student_name} on ${formatDate(deleting?.date)} will be removed.`}
        confirmLabel="Delete record"
      />
    </>
  );
}
