import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarCheck,
  CheckCheck,
  ClipboardCheck,
  Download,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { downloadCSV, formatDate, percent, todayISO } from "../lib/format";
import { ATTENDANCE_STATUSES } from "../lib/constants";
import { useDebounced, useFetch, useList, useReferenceData } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  Spinner,
  StatCard,
  StatusBadge,
  Tabs,
} from "../components/ui";
import { AreaChart } from "../components/charts";

const STATUS_BUTTONS = ATTENDANCE_STATUSES;

export default function Attendance() {
  const { isAdmin, hasRole } = useAuth();
  if (hasRole("Student", "Parent") && !isAdmin && !hasRole("Teacher", "Accountant")) {
    return <MyAttendance />;
  }
  return <StaffAttendance canManage={isAdmin || hasRole("Teacher")} isAdmin={isAdmin} />;
}

/* ------------------------------------------------------------------ staff */
function StaffAttendance({ canManage, isAdmin }) {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(canManage ? "mark" : "records");
  const defaultSection = searchParams.get("section") || "";

  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark daily attendance and review trends" />
      <Tabs
        tabs={[
          ...(canManage ? [{ value: "mark", label: "Mark attendance" }] : []),
          { value: "records", label: "Records & insights" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "mark" ? <MarkAttendance defaultSection={defaultSection} /> : <AttendanceRecords isAdmin={isAdmin} />}
    </>
  );
}

function MarkAttendance({ defaultSection }) {
  const toast = useToast();
  const { sections } = useReferenceData({ sections: true });
  const [section, setSection] = useState(defaultSection);
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!section && sections.length) setSection(defaultSection || sections[0].uuid);
  }, [sections, section, defaultSection]);

  const loadSheet = async () => {
    if (!section) return;
    setLoading(true);
    setError(null);
    setDirty(false);
    try {
      const data = await api.get("/attendance/sheet/", { section, date });
      setRows(
        (data.rows || []).map((row) => ({
          ...row,
          status: row.status || "present",
          remarks: row.remarks || "",
        }))
      );
    } catch (err) {
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, date]);

  const counts = useMemo(() => {
    const totals = { present: 0, absent: 0, late: 0, excused: 0 };
    rows.forEach((row) => {
      totals[row.status] = (totals[row.status] || 0) + 1;
    });
    return totals;
  }, [rows]);

  const setStatus = (uuid, status) => {
    setRows((current) => current.map((row) => (row.student_uuid === uuid ? { ...row, status } : row)));
    setDirty(true);
  };

  const setAll = (status) => {
    setRows((current) => current.map((row) => ({ ...row, status })));
    setDirty(true);
  };

  const save = async () => {
    if (!rows.length) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.post("/attendance/bulk/", {
        section,
        date,
        records: rows.map((row) => ({ student: row.student_uuid, status: row.status, remarks: row.remarks || "" })),
      });
      toast.success(result.detail, "Attendance saved");
      setDirty(false);
      loadSheet();
    } catch (err) {
      setError(err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isFuture = date > todayISO();

  return (
    <Card
      title="Daily register"
      subtitle={section ? sections.find((item) => item.uuid === section)?.display_name : "Select a section"}
      actions={
        <>
          <select className="select" style={{ width: "auto", minWidth: 180 }} value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">Select section…</option>
            {sections.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
          </select>
          <input className="input" type="date" style={{ width: 160 }} max={todayISO()} value={date} onChange={(event) => setDate(event.target.value)} />
        </>
      }
      flush
    >
      {error ? <div style={{ padding: "14px 18px" }}><ErrorBanner error={error} /></div> : null}
      {isFuture ? (
        <div style={{ padding: "14px 18px" }} className="notice warning">Future dates cannot be marked. Choose today or an earlier date.</div>
      ) : null}

      {section && rows.length ? (
        <div className="bulk-bar">
          <span><strong>{rows.length}</strong> students ·</span>
          <Badge tone="green">{counts.present} present</Badge>
          <Badge tone="red">{counts.absent} absent</Badge>
          <Badge tone="amber">{counts.late} late</Badge>
          <Badge tone="blue">{counts.excused} excused</Badge>
          <span style={{ marginLeft: "auto" }} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll("present")}><CheckCheck size={14} /> All present</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll("absent")}>All absent</button>
        </div>
      ) : null}

      {!section ? (
        <EmptyState icon={Users} title="Select a section" description="Choose a class section to load the student roster." />
      ) : loading ? (
        <Loading label="Loading roster…" />
      ) : rows.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Student</th><th>Status</th><th style={{ width: 220 }}>Remarks</th></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.student_uuid}>
                    <td className="cell-sub">{index + 1}</td>
                    <td>
                      <div className="cell-user">
                        <Avatar name={row.student_name} size="sm" />
                        <div>
                          <div className="cell-main">{row.student_name}</div>
                          <div className="cell-sub">{row.student_code} {row.roll_number ? `· Roll ${row.roll_number}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="sheet-statuses">
                        {STATUS_BUTTONS.map((status) => (
                          <button
                            type="button"
                            key={status.value}
                            className={`status-chip ${row.status === status.value ? "active" : ""} ${status.value}`}
                            onClick={() => setStatus(row.student_uuid, status.value)}
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        className="input"
                        style={{ height: 33, minHeight: 33 }}
                        placeholder="Optional note"
                        value={row.remarks}
                        maxLength={255}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRows((current) => current.map((item) => (item.student_uuid === row.student_uuid ? { ...item, remarks: value } : item)));
                          setDirty(true);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: dirty ? "var(--warning)" : "var(--muted)" }}>
              {dirty ? "You have unsaved changes." : "All changes saved."}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={loadSheet} disabled={saving}>Reset</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || isFuture}>
                {saving ? <Spinner size={16} light /> : <Save size={16} />}
                {saving ? "Saving…" : "Save attendance"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={UserCheck} title="No students in this section" description="Admit students or assign them to this section first." />
      )}
    </Card>
  );
}

function AttendanceRecords({ isAdmin }) {
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
  const summary = useFetch(`/attendance/summary/?days=30${section ? `&section=${section}` : ""}`, { deps: [section] });

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

  return (
    <>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <StatCard icon={CalendarCheck} label="Attendance rate" value={percent(totals.attendance_rate)} hint="last 30 days" tone="emerald" />
        <StatCard icon={CheckCheck} label="Present" value={totals.present ?? 0} hint={`${totals.late ?? 0} late arrivals`} tone="indigo" />
        <StatCard icon={Users} label="Absent" value={totals.absent ?? 0} hint={`${totals.excused ?? 0} excused`} tone="rose" />
        <StatCard icon={ClipboardCheck} label="Records" value={totals.total ?? 0} hint="last 30 days" tone="cyan" />
      </div>

      <Card title="Attendance trend" subtitle="Daily present rate · last 30 days">
        {summary.loading ? <Loading /> : daily.length ? (
          <AreaChart data={daily} color="#10b981" formatValue={(value) => `${Math.round(value)}%`} height={220} />
        ) : <EmptyState icon={CalendarCheck} title="No attendance data" description="Records will appear once attendance is marked." />}
      </Card>

      <Card title="Attendance records" subtitle={`${list.count} record(s)`} style={{ marginTop: 20 }} flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search student…" />
          <select className="select" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {sections.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
          </select>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUS_BUTTONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} title="From date" />
          <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} title="To date" />
        </div>

        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Student</th><th>Section</th><th>Date</th><th>Status</th><th>Remarks</th><th>Marked by</th>{isAdmin ? <th className="actions">Actions</th> : null}</tr></thead>
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
                      <td>{formatDate(record.date)}</td>
                      <td><StatusBadge status={record.status} /></td>
                      <td className="cell-sub">{record.remarks || "—"}</td>
                      <td className="cell-sub">{record.marked_by_name || "—"}</td>
                      {isAdmin ? (
                        <td className="actions">
                          <button type="button" className="icon-btn danger" onClick={() => setDeleting(record)}><Trash2 size={15} /></button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="records" />
          </>
        ) : <EmptyState icon={CalendarCheck} title="No attendance records" description="Try changing filters or mark attendance." />}
      </Card>

      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this record?" message={`Attendance for ${deleting?.student_name} on ${formatDate(deleting?.date)} will be removed.`} confirmLabel="Delete record" />
    </>
  );
}

/* ------------------------------------------------------------------ family */
function MyAttendance() {
  const { hasRole } = useAuth();
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
      list.rows.map((record) => [record.date, record.student_name, record.section_name, record.status, record.remarks]),
      ["Date", "Student", "Section", "Status", "Remarks"]
    );
  };

  return (
    <>
      <PageHeader
        title={hasRole("Parent") ? "Children's attendance" : "My attendance"}
        subtitle="Attendance history over the last 90 days"
        actions={<button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}><Download size={16} /> Export</button>}
      />
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <StatCard icon={CalendarCheck} label="Attendance rate" value={percent(totals.attendance_rate)} tone="emerald" />
        <StatCard icon={CheckCheck} label="Present" value={totals.present ?? 0} tone="indigo" />
        <StatCard icon={Users} label="Absent" value={totals.absent ?? 0} tone="rose" />
        <StatCard icon={ClipboardCheck} label="Total records" value={totals.total ?? 0} tone="cyan" />
      </div>

      <Card title="Daily attendance rate" subtitle="Last 90 days">
        {summary.loading ? <Loading /> : daily.length ? <AreaChart data={daily} color="#10b981" formatValue={(value) => `${Math.round(value)}%`} /> : <EmptyState icon={CalendarCheck} title="No attendance yet" />}
      </Card>

      <Card title="History" subtitle={`${list.count} record(s)`} style={{ marginTop: 20 }} flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUS_BUTTONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Student</th><th>Section</th><th>Status</th><th>Remarks</th></tr></thead>
                <tbody>
                  {list.rows.map((record) => (
                    <tr key={record.uuid}>
                      <td className="cell-main">{formatDate(record.date)}</td>
                      <td>{record.student_name}</td>
                      <td className="cell-sub">{record.section_name}</td>
                      <td><StatusBadge status={record.status} /></td>
                      <td className="cell-sub">{record.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="records" />
          </>
        ) : <EmptyState icon={CalendarCheck} title="No attendance records" description="Records will appear once the school marks attendance." />}
      </Card>
    </>
  );
}
