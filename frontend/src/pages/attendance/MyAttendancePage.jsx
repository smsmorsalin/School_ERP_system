import { useEffect, useState } from "react";
import { CalendarCheck, CheckCheck, ClipboardCheck, Download, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { api } from "../../lib/api";
import { downloadCSV, formatDate, percent } from "../../lib/format";
import { ATTENDANCE_STATUSES } from "../../lib/constants";
import { useFetch, useList } from "../../lib/hooks";
import {
  Card,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  StatCard,
  StatusBadge,
  Toolbar,
} from "../../components/ui";
import { AreaChart } from "../../components/charts";

const STATUS_BUTTONS = ATTENDANCE_STATUSES;

/** Family-facing attendance history: read-only, exportable, no admin controls. */
export default function MyAttendancePage() {
  const { hasRole } = useAuth();
  const isParent = hasRole("Parent");
  usePageTitle(isParent ? "Children's attendance" : "My attendance");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const list = useList("/my-attendance/", { ordering: "-date" });
  const summary = useFetch("/attendance/summary/?days=90", { deps: [] });

  useEffect(() => {
    list.update({ status, date_from: dateFrom, date_to: dateTo, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dateFrom, dateTo]);

  const totals = summary.data?.totals || {};
  const daily = (summary.data?.daily || []).map((row) => ({
    label: new Date(row.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    value: row.rate,
  }));

  const exportRows = () => {
    downloadCSV(
      "attendance.csv",
      list.rows.map((record) => [
        record.date,
        ...(isParent ? [record.student_name] : []),
        record.section_name,
        record.status,
        record.remarks,
      ]),
      ["Date", ...(isParent ? ["Student"] : []), "Section", "Status", "Remarks"]
    );
  };

  return (
    <>
      <PageHeader
        title={hasRole("Parent") ? "Children's attendance" : "My attendance"}
        subtitle="Attendance history over the last 90 days."
        actions={
          <button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}>
            <Download size={16} /> Export
          </button>
        }
      />

      <div className="stat-grid">
        <StatCard icon={CalendarCheck} label="Attendance rate" value={percent(totals.attendance_rate)} tone="emerald" />
        <StatCard icon={CheckCheck} label="Present" value={totals.present ?? 0} tone="indigo" />
        <StatCard icon={Users} label="Absent" value={totals.absent ?? 0} tone="rose" />
        <StatCard icon={ClipboardCheck} label="Total records" value={totals.total ?? 0} tone="cyan" />
      </div>

      <Card title="Daily attendance rate" subtitle="Last 90 days">
        {summary.loading ? (
          <Loading />
        ) : daily.length ? (
          <AreaChart data={daily} color="#17613d" formatValue={(value) => `${Math.round(value)}%`} />
        ) : (
          <EmptyState icon={CalendarCheck} title="No attendance yet" />
        )}
      </Card>

      <Card title="History" subtitle={`${list.count} record(s)`} style={{ marginTop: 20 }} flush>
        <Toolbar meta={<span>{list.count} records</span>}>
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
                    <th>Date</th>
                    {isParent ? <th>Student</th> : null}
                    <th>Section</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((record) => (
                    <tr key={record.uuid}>
                      <td className="cell-main num">{formatDate(record.date)}</td>
                      {isParent ? <td>{record.student_name}</td> : null}
                      <td className="cell-sub">{record.section_name}</td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="cell-sub">{record.remarks || "—"}</td>
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
            description="Records will appear once the school marks attendance."
          />
        )}
      </Card>
    </>
  );
}
