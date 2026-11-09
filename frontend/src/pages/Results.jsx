import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, Download, FileText, GraduationCap, Printer, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { downloadCSV, formatDate, gradeTone, percent } from "../lib/format";
import { useAll, useDebounced, useFetch, useList, useReferenceData } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Spinner,
} from "../components/ui";

export default function Results() {
  const { isAdmin, hasRole } = useAuth();
  if (hasRole("Student", "Parent") && !isAdmin && !hasRole("Teacher")) return <FamilyResults />;
  return <StaffResults />;
}

/* ------------------------------------------------------------------ staff */
function StaffResults() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [exam, setExam] = useState(searchParams.get("exam") || "");
  const [section, setSection] = useState("");
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const { sections } = useReferenceData({ sections: true });
  const { data: exams } = useAll("/exams/", { ordering: "-start_date" });
  const list = useList("/exam-results/", { ordering: "-exam_subject__exam__start_date" });

  useEffect(() => {
    list.update({ exam, section, search: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, section, debounced]);

  const openReport = async (studentUuid, examUuid) => {
    setReportLoading(true);
    setReportError(null);
    setReport({});
    try {
      setReport(await api.get("/exam-results/report-card/", { student: studentUuid, exam: examUuid }));
    } catch (error) {
      setReportError(error);
    } finally {
      setReportLoading(false);
    }
  };

  const openFromQuery = () => {
    const student = searchParams.get("student");
    const examUuid = searchParams.get("exam");
    if (student) openReport(student, examUuid || "");
  };

  useEffect(() => {
    openFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportRows = () => {
    downloadCSV(
      "results.csv",
      list.rows.map((row) => [row.student_name, row.student_code, row.exam_name, row.subject_name, row.marks_obtained, row.max_marks, row.grade, row.is_pass ? "Pass" : "Fail"]),
      ["Student", "Student ID", "Exam", "Subject", "Marks", "Max", "Grade", "Outcome"]
    );
  };

  return (
    <>
      <PageHeader
        title="Results"
        subtitle={`${list.count} result record(s)`}
        actions={<button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!list.rows.length}><Download size={16} /> Export</button>}
      />

      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search student…" />
          <select className="select" value={exam} onChange={(event) => setExam(event.target.value)}>
            <option value="">All exams</option>
            {exams.map((item) => <option key={item.uuid} value={item.uuid}>{item.name}</option>)}
          </select>
          <select className="select" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {sections.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
          </select>
        </div>

        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Student</th><th>Exam</th><th>Subject</th><th className="num">Marks</th><th>%</th><th>Grade</th><th>Outcome</th><th className="actions">Actions</th></tr></thead>
                <tbody>
                  {list.rows.map((row) => (
                    <tr key={row.uuid}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={row.student_name} size="sm" />
                          <div>
                            <div className="cell-main">{row.student_name}</div>
                            <div className="cell-sub">{row.student_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>{row.exam_name}</div>
                        <div className="cell-sub">{row.subject_name}</div>
                      </td>
                      <td>{row.subject_name} <span className="cell-sub">{row.subject_code}</span></td>
                      <td className="num">{row.marks_obtained} / {row.max_marks}</td>
                      <td>{percent(row.percentage)}</td>
                      <td><Badge tone={gradeTone(row.grade)}>{row.grade || "—"}</Badge></td>
                      <td><Badge tone={row.is_pass ? "green" : "red"}>{row.is_pass ? "Pass" : "Fail"}</Badge></td>
                      <td className="actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openReport(row.student_uuid, exams.find((item) => item.name === row.exam_name)?.uuid || "")} disabled={!row.student_uuid}>
                          <FileText size={13} /> Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="results" />
          </>
        ) : <EmptyState icon={FileText} title="No results found" description="Enter marks for an exam to see results here." />}
      </Card>

      <ReportModal
        report={report}
        loading={reportLoading}
        error={reportError}
        onClose={() => setReport(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ family */
function FamilyResults() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [student, setStudent] = useState(params.get("student") || "");
  const [exam, setExam] = useState(params.get("exam") || "");
  const { data: children } = useAll("/academics/students/my-children/", {}, { enabled: hasRole("Parent") });
  const self = useFetch("/academics/students/me/", { enabled: hasRole("Student") && !hasRole("Parent") });
  const { data: exams } = useAll("/exams/", { ordering: "-start_date" });
  const students = hasRole("Student") && !hasRole("Parent") ? (self.data ? [self.data] : []) : children;

  useEffect(() => {
    if (!student && students.length) setStudent(students[0].uuid);
  }, [students, student]);

  useEffect(() => {
    if (!exam && exams.length) setExam(exams[0].uuid);
  }, [exams, exam]);

  const report = useFetch(
    student && exam ? `/exam-results/report-card/?student=${student}&exam=${exam}` : null,
    { enabled: Boolean(student && exam), deps: [student, exam] }
  );

  const change = (key, value) => {
    if (key === "student") {
      setStudent(value);
      params.set("student", value);
    } else {
      setExam(value);
      params.set("exam", value);
    }
    setParams(params, { replace: true });
  };

  if (self.loading && !students.length) return <Loading />;

  return (
    <>
      <PageHeader title={hasRole("Parent") ? "Children's results" : "My results"} subtitle="Published report cards and grades" />
      <Card style={{ marginBottom: 20 }}>
        <div className="filters">
          {students.length > 1 ? (
            <select className="select" value={student} onChange={(event) => change("student", event.target.value)}>
              {students.map((child) => <option key={child.uuid} value={child.uuid}>{child.user?.full_name} — {child.student_id}</option>)}
            </select>
          ) : students[0] ? (
            <Badge tone="indigo">{students[0].user?.full_name} · {students[0].student_id}</Badge>
          ) : null}
          <select className="select" value={exam} onChange={(event) => change("exam", event.target.value)}>
            <option value="">Select exam…</option>
            {exams.map((item) => <option key={item.uuid} value={item.uuid}>{item.name} · {formatDate(item.start_date)}</option>)}
          </select>
        </div>
      </Card>

      {!students.length ? (
        <EmptyState icon={GraduationCap} title="No student linked" description="Contact the school office to link your account." />
      ) : !exams.length ? (
        <EmptyState icon={Award} title="No published results" description="Your report cards will appear here once the school publishes results." />
      ) : report.loading ? (
        <Loading label="Loading report card…" />
      ) : report.error ? (
        <ErrorBanner error={report.error} />
      ) : report.data ? (
        <ReportCardContent report={report.data} />
      ) : (
        <EmptyState icon={Award} title="Select an exam" description="Choose an exam to view the report card." />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ report card */
function ReportModal({ report, loading, error, onClose }) {
  return (
    <Modal
      open={Boolean(report)}
      onClose={onClose}
      title="Report card"
      size="modal-lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary no-print" onClick={() => window.print()} disabled={!report?.student}>
            <Printer size={15} /> Print
          </button>
        </>
      }
    >
      {loading ? <Loading /> : error ? <ErrorBanner error={error} /> : report?.student ? <ReportCardContent report={report} /> : <EmptyState icon={Award} title="No results found" />}
    </Modal>
  );
}

function ReportCardContent({ report }) {
  const { student, exam, results = [], totals = {} } = report;
  return (
    <div>
      <div className="report-head">
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 4 }}>Academic report</div>
          <h3>{exam?.name}</h3>
          <p>{exam?.term} · {student?.class || ""} {student?.section ? `— ${student.section}` : ""}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={student?.full_name} size="lg" />
          <div>
            <div style={{ fontWeight: 700 }}>{student?.full_name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{student?.student_id}</div>
            <Badge tone={exam?.is_published ? "green" : "amber"}>{exam?.is_published ? "Published" : "Unpublished"}</Badge>
          </div>
        </div>
      </div>

      {results.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Subject</th><th className="num">Marks</th><th className="num">Max</th><th className="num">Pass</th><th>%</th><th>Grade</th></tr></thead>
            <tbody>
              {results.map((row, index) => (
                <tr key={`${row.subject_code}-${index}`}>
                  <td className="cell-main">{row.subject} <span className="cell-sub">{row.subject_code}</span></td>
                  <td className="num">{row.marks_obtained}</td>
                  <td className="num">{row.max_marks}</td>
                  <td className="num">{row.pass_marks}</td>
                  <td>{percent(row.percentage)}</td>
                  <td><Badge tone={gradeTone(row.grade)}>{row.grade || "—"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No subject results" />}

      <div className="report-total">
        <div><span>Obtained</span><strong>{totals.obtained}</strong></div>
        <div><span>Out of</span><strong>{totals.max}</strong></div>
        <div><span>Percentage</span><strong>{percent(totals.percentage)}</strong></div>
        <div><span>Grade</span><strong>{totals.grade || "—"}</strong></div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <Badge tone={totals.passed ? "green" : "red"}>{totals.passed ? "Passed" : "Not passed"}</Badge>
        <Badge tone="indigo">Grade points {totals.grade_point}</Badge>
        {totals.position ? <Badge tone="amber">Class position #{totals.position}</Badge> : null}
      </div>
      <p className="help" style={{ marginTop: 12 }}>This is a computer-generated report card from School ERP.</p>
    </div>
  );
}
