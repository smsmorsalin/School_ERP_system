import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCheck, Save, UserCheck, Users } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { formatDate, todayISO } from "../../lib/format";
import { ATTENDANCE_STATUSES } from "../../lib/constants";
import { useReferenceData } from "../../lib/hooks";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  Spinner,
  Toolbar,
} from "../../components/ui";

const STATUS_BUTTONS = ATTENDANCE_STATUSES;

/** The daily register is a focused task: one section, one date, one save. */
export default function RegisterPage() {
  usePageTitle("Take register");
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { sections } = useReferenceData({ sections: true });
  const [section, setSection] = useState(searchParams.get("section") || "");
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!section && sections.length) setSection(searchParams.get("section") || sections[0].uuid);
  }, [sections, section, searchParams]);

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
  const currentSection = sections.find((item) => item.uuid === section);

  return (
    <>
      <PageHeader
        title="Take register"
        subtitle="Mark attendance for one section. Changes are saved together when you submit."
        meta={
          currentSection ? (
            <>
              <Badge tone="indigo">{currentSection.display_name}</Badge>
              <Badge tone="neutral">{formatDate(date)}</Badge>
            </>
          ) : null
        }
      />

      <Card flush>
        <Toolbar
          meta={
            <span>
              {currentSection ? currentSection.display_name : "Choose a section"} ·{" "}
              {formatDate(date)}
            </span>
          }
        >
          <select
            className="select"
            aria-label="Select a section"
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="">Select section…</option>
            {sections.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.display_name}
              </option>
            ))}
          </select>
          <input
            className="input"
            aria-label="Register date"
            type="date"
            style={{ width: 170 }}
            max={todayISO()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Toolbar>

        {error ? (
          <div style={{ padding: "14px 18px" }}>
            <ErrorBanner error={error} />
          </div>
        ) : null}
        {isFuture ? (
          <div style={{ padding: "14px 18px" }}>
            <div className="notice warning">Future dates cannot be marked. Choose today or an earlier date.</div>
          </div>
        ) : null}

        {section && rows.length ? (
          <div className="bulk-bar">
            <span>
              <strong>{rows.length}</strong> students ·
            </span>
            <Badge tone="green">{counts.present} present</Badge>
            <Badge tone="red">{counts.absent} absent</Badge>
            <Badge tone="amber">{counts.late} late</Badge>
            <Badge tone="blue">{counts.excused} excused</Badge>
            <span style={{ marginLeft: "auto" }} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll("present")}>
              <CheckCheck size={14} /> All present
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll("absent")}>
              All absent
            </button>
          </div>
        ) : null}

        {!section ? (
          <EmptyState icon={Users} title="Select a section" description="Choose a class section to load its student roster." />
        ) : loading ? (
          <Loading label="Loading roster…" />
        ) : rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Student</th>
                    <th>Status</th>
                    <th style={{ width: 240 }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.student_uuid}>
                      <td className="cell-sub num">{index + 1}</td>
                      <td>
                        <div className="cell-user">
                          <Avatar name={row.student_name} size="sm" />
                          <div>
                            <div className="cell-main">{row.student_name}</div>
                            <div className="cell-sub">
                              {row.student_code}
                              {row.roll_number ? ` · Roll ${row.roll_number}` : ""}
                            </div>
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
                            setRows((current) =>
                              current.map((item) =>
                                item.student_uuid === row.student_uuid ? { ...item, remarks: value } : item
                              )
                            );
                            setDirty(true);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-footer register-footer">
              <span className={dirty ? "register-state dirty" : "register-state"}>
                {dirty ? "You have unsaved changes." : "All changes saved."}
              </span>
              <div className="register-actions">
                <button type="button" className="btn btn-secondary" onClick={loadSheet} disabled={saving}>
                  Reset
                </button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving || isFuture}>
                  {saving ? <Spinner size={16} light /> : <Save size={16} />}
                  {saving ? "Saving…" : "Save attendance"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={UserCheck}
            title="No students in this section"
            description="Admit students or assign them to this section first."
          />
        )}
      </Card>
    </>
  );
}
