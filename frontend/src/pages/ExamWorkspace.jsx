import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
  Unlock,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../lib/usePageTitle";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, formatTime } from "../lib/format";
import { useAll, useFetch, useReferenceData } from "../lib/hooks";
import {
  Badge,
  Breadcrumbs,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
} from "../components/ui";
import { DonutChart, palette } from "../components/charts";
import { ExamFormModal, ExamSubjectFormModal } from "./ExamModals";

const ORDERING = "section__school_class__level,subject__name";

/**
 * Exam workspace: papers and analytics for one exam, each on its own URL.
 * Mark entry is a separate page (`ExamMarksPage`) so a long roster never
 * competes with setup controls.
 */
export default function ExamWorkspace({ view = "papers" }) {
  const { uuid } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const examState = useFetch(`/exams/${uuid}/`, { deps: [uuid] });
  const analytics = useFetch(`/exams/analytics/?exam=${uuid}`, { enabled: view === "analytics", deps: [uuid, view] });
  const papers = useAll("/exam-subjects/", { exam: uuid, ordering: ORDERING }, { enabled: Boolean(examState.data) });
  const { sections, subjects, years } = useReferenceData({ sections: true, subjects: true, years: true });
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState(null);
  const [deletingPaper, setDeletingPaper] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);

  const exam = examState.data;
  const term = exam?.term?.replace("_", " ");
  usePageTitle(exam ? `${exam.name} · ${view === "analytics" ? "Analytics" : "Papers"}` : "Exam");

  const togglePublish = async () => {
    setPublishBusy(true);
    try {
      const result = await api.post(`/exams/${uuid}/publish/`, { published: !exam.is_published });
      toast.success(result.detail);
      examState.reload();
      papers.reload();
      if (view === "analytics") analytics.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPublishBusy(false);
    }
  };

  const removePaper = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/exam-subjects/${deletingPaper.uuid}/`);
      toast.success("Paper removed.");
      setDeletingPaper(null);
      papers.reload();
      examState.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (examState.loading) {
    return <Loading label="Loading exam…" />;
  }

  if (examState.error) {
    return (
      <>
        <Breadcrumbs items={[{ label: "Examinations", to: "/exams" }, { label: "Exam" }]} />
        <ErrorBanner error={examState.error} />
      </>
    );
  }

  if (!exam) {
    return (
      <>
        <Breadcrumbs items={[{ label: "Examinations", to: "/exams" }, { label: "Exam" }]} />
        <Card><EmptyState icon={FileSpreadsheet} title="Exam not found" description="It may have been deleted or you may not have access." /></Card>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "Examinations", to: "/exams" }, { label: exam.name }]} />
      <PageHeader
        title={exam.name}
        subtitle={`${term} · ${exam.academic_year_name} · ${formatDate(exam.start_date)} – ${formatDate(exam.end_date)}`}
        actions={
          <>
            {isAdmin ? (
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={15} /> Edit exam
              </button>
            ) : null}
            {isAdmin ? (
              <button type="button" className="btn btn-primary" onClick={togglePublish} disabled={publishBusy}>
                {publishBusy ? <Spinner size={15} light /> : exam.is_published ? <Unlock size={15} /> : <Send size={15} />}
                {exam.is_published ? "Unpublish results" : "Publish results"}
              </button>
            ) : null}
          </>
        }
      />

      <div className="stat-grid">
        <StatCard icon={ClipboardList} label="Papers" value={exam.subject_count} hint="scheduled subjects" tone="indigo" />
        <StatCard icon={Users} label="Sections" value={exam.section_count} hint="participating classes" tone="cyan" />
        <StatCard icon={BarChart3} label="Results" value={exam.result_count} hint="marks recorded" tone="emerald" />
        <StatCard
          icon={exam.is_published ? Lock : FileSpreadsheet}
          label="Result status"
          value={exam.is_published ? "Published" : "Draft"}
          hint={exam.is_published ? "marks are locked" : "marks can be edited"}
          tone={exam.is_published ? "amber" : "violet"}
        />
      </div>

      <div className="tabs" role="tablist" aria-label="Exam workspace">
        <NavLink
          to={`/exams/${uuid}`}
          end
          role="tab"
          aria-selected={view === "papers"}
          aria-controls="exam-tab-papers"
          id="exam-tab-papers-label"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Papers <span className="count">{papers.data.length}</span>
        </NavLink>
        <NavLink
          to={`/exams/${uuid}/analytics`}
          role="tab"
          aria-selected={view === "analytics"}
          aria-controls="exam-tab-analytics"
          id="exam-tab-analytics-label"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Analytics
        </NavLink>
      </div>

      {view === "analytics" ? (
        <section id="exam-tab-analytics" role="tabpanel" aria-labelledby="exam-tab-analytics-label">
          <Card title="Grade distribution" subtitle="Calculated from saved marks across every paper">
          {analytics.loading ? <Loading /> : analytics.error ? (
            <ErrorBanner error={analytics.error} />
          ) : analytics.data ? (
            <div className="grid-2">
              <div>
                <DonutChart
                  data={(analytics.data.distribution || []).filter((row) => row.count > 0).map((row, index) => ({
                    label: `Grade ${row.grade}`,
                    value: row.count,
                    color: palette[index % palette.length],
                  }))}
                  centerLabel="Results"
                  centerValue={analytics.data.result_count}
                />
              </div>
              <div>
                <div className="stat-card" style={{ marginBottom: 12 }}>
                  <div className="stat-icon indigo"><BarChart3 /></div>
                  <div className="stat-body">
                    <div className="label">Average marks</div>
                    <div className="value">{analytics.data.average_marks}</div>
                    <div className="hint">across {analytics.data.result_count} results</div>
                  </div>
                </div>
                <div className="notice info">
                  Grade bands are calculated automatically from percentages when marks are saved.
                </div>
                {exam.is_published ? (
                  <div className="notice warning" style={{ marginTop: 10 }}>
                    <Lock size={14} /> Results are published. Unpublish the exam to change marks.
                  </div>
                ) : null}
              </div>
            </div>
          ) : <EmptyState icon={BarChart3} title="No analytics yet" description="Enter marks to see grade distribution." />}
        </Card>
        </section>
      ) : (
        <section id="exam-tab-papers" role="tabpanel" aria-labelledby="exam-tab-papers-label">
        <Card
          flush
          title="Exam papers"
          subtitle="Subject papers scheduled for each section"
          actions={
            isAdmin ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditingPaper(null); setAddOpen(true); }}>
                <Plus size={14} /> Add paper
              </button>
            ) : null
          }
        >
          {exam.is_published ? (
            <div className="notice warning" style={{ margin: "14px 18px 0" }}>
              <Lock size={15} /> Results are published. Marks entry is locked until the exam is unpublished.
            </div>
          ) : null}
          {papers.loading ? <Loading /> : papers.data.length ? (
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Section</th><th>Subject</th><th>Date</th><th>Time</th><th>Max / pass</th><th>Results</th><th className="actions">Actions</th></tr></thead>
                <tbody>
                  {papers.data.map((paper) => (
                    <tr key={paper.uuid}>
                      <td>{paper.section_name}</td>
                      <td><div className="cell-main">{paper.subject_name}</div><div className="cell-sub">{paper.subject_code}</div></td>
                      <td className="cell-sub">{formatDate(paper.exam_date)}</td>
                      <td className="cell-sub">{paper.start_time ? formatTime(paper.start_time) : "—"}</td>
                      <td>{paper.max_marks} / {paper.pass_marks}</td>
                      <td>{paper.result_count}</td>
                      <td className="actions">
                        {exam.is_published ? (
                          <button type="button" className="btn btn-secondary btn-sm" disabled title="Unpublish the exam to edit marks">
                            <ClipboardList size={13} /> Marks
                          </button>
                        ) : (
                          <Link className="btn btn-secondary btn-sm" to={`/exams/${uuid}/papers/${paper.uuid}`}>
                            <ClipboardList size={13} /> Marks
                          </Link>
                        )}
                        {isAdmin ? (
                          <>
                            <button type="button" className="icon-btn" aria-label="Edit paper" onClick={() => { setEditingPaper(paper); setAddOpen(true); }} title="Edit paper"><Pencil size={14} /></button>
                            <button type="button" className="icon-btn danger" aria-label="Delete paper" onClick={() => setDeletingPaper(paper)} title="Remove paper"><Trash2 size={14} /></button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="No papers yet" description={isAdmin ? "Add the first subject paper for a section." : "No papers are assigned to you."} />
          )}
        </Card>
        </section>
      )}

      <ExamFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        exam={exam}
        years={years}
        onSaved={() => { setEditOpen(false); examState.reload(); }}
      />

      <ExamSubjectFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        exam={exam}
        paper={editingPaper}
        sections={sections}
        subjects={subjects}
        onSaved={() => { setAddOpen(false); papers.reload(); examState.reload(); }}
      />

      <ConfirmDialog
        open={Boolean(deletingPaper)}
        onClose={() => setDeletingPaper(null)}
        onConfirm={removePaper}
        busy={deleteBusy}
        title="Remove this paper?"
        message={`${deletingPaper?.subject_name} for ${deletingPaper?.section_name} will be removed along with its results.`}
        confirmLabel="Remove paper"
      />
    </>
  );
}

/** Full-page mark entry for one paper. */
export function ExamMarksPage() {
  const { uuid, paperUuid } = useParams();
  const toast = useToast();
  const examState = useFetch(`/exams/${uuid}/`, { deps: [uuid] });
  const paperState = useFetch(`/exam-subjects/${paperUuid}/`, { deps: [paperUuid] });
  const paper = paperState.data;
  const exam = examState.data;
  const sheet = useFetch(paper ? `/exam-subjects/${paperUuid}/sheet/` : null, { enabled: Boolean(paper), deps: [paperUuid] });
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const published = Boolean(exam?.is_published);
  const max = Number(paper?.max_marks || 0);
  usePageTitle(paper ? `Marks · ${paper.subject_name}` : "Mark entry");

  useEffect(() => {
    if (!sheet.data) return;
    setRows((sheet.data.rows || []).map((row) => ({ ...row, marks_obtained: row.marks_obtained ?? "" })));
  }, [sheet.data]);

  const valid = useMemo(() => {
    if (!rows.length) return false;
    return rows.every((row) => {
      if (row.marks_obtained === "" || row.marks_obtained === null) return false;
      const value = Number(row.marks_obtained);
      return Number.isFinite(value) && value >= 0 && value <= max;
    });
  }, [rows, max]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await api.post(`/exam-subjects/${paperUuid}/bulk-results/`, {
        results: rows.map((row) => ({
          student: row.student_uuid,
          marks_obtained: Number(row.marks_obtained),
          remarks: row.remarks || "",
        })),
      });
      toast.success(`${result.created} created, ${result.updated} updated.`, "Marks saved");
      sheet.reload();
    } catch (err) {
      setSaveError(err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loading = examState.loading || paperState.loading;
  const error = examState.error || paperState.error;

  if (loading) {
    return <Loading label="Loading paper…" />;
  }

  if (error) {
    return (
      <>
        <Breadcrumbs items={[{ label: "Examinations", to: "/exams" }, { label: "Mark entry" }]} />
        <ErrorBanner error={error} />
      </>
    );
  }

  if (!paper || !exam) {
    return (
      <>
        <Breadcrumbs items={[{ label: "Examinations", to: "/exams" }, { label: "Mark entry" }]} />
        <Card><EmptyState icon={ClipboardList} title="Paper not found" description="It may have been removed from the exam." /></Card>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Examinations", to: "/exams" },
          { label: exam.name, to: `/exams/${uuid}` },
          { label: `Marks · ${paper.subject_name}` },
        ]}
      />
      <PageHeader
        title={`Marks · ${paper.subject_name}`}
        subtitle={`${exam.name} · ${paper.section_name} · max ${paper.max_marks} · pass ${paper.pass_marks}`}
        actions={
          <>
            <Link className="btn btn-secondary" to={`/exams/${uuid}`}>Back to exam</Link>
            {!published ? (
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !valid}>
                {saving ? <Spinner size={15} light /> : <CheckCircle2 size={15} />}
                {saving ? "Saving…" : "Save marks"}
              </button>
            ) : null}
          </>
        }
      />

      {published ? (
        <div className="notice warning" style={{ marginBottom: 14 }}>
          <Lock size={15} /> This exam is published, so marks are read-only.
        </div>
      ) : null}
      <ErrorBanner error={saveError} onDismiss={() => setSaveError(null)} />

      <Card
        flush
        title="Student marks"
        subtitle={`${formatDate(paper.exam_date)}${paper.start_time ? ` · ${formatTime(paper.start_time)}` : ""}`}
        actions={<Badge tone="neutral">{rows.length} students</Badge>}
      >
        {sheet.loading ? <Loading label="Loading roster…" /> : sheet.error ? (
          <div style={{ padding: 16 }}><ErrorBanner error={sheet.error} /></div>
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="table table-compact">
              <thead><tr><th>#</th><th>Student</th><th>Marks</th><th>Grade</th><th>Remarks</th></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.student_uuid}>
                    <td className="cell-sub">{index + 1}</td>
                    <td>
                      <div className="cell-main">{row.student_name}</div>
                      <div className="cell-sub">{row.student_code} {row.roll_number ? `· Roll ${row.roll_number}` : ""}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <input
                          className="marks-input"
                          type="number"
                          min="0"
                          max={max}
                          step="0.01"
                          value={row.marks_obtained}
                          disabled={published}
                          aria-label={`Marks for ${row.student_name}`}
                          onChange={(event) => {
                            const value = event.target.value;
                            setRows((current) => current.map((item) => (item.student_uuid === row.student_uuid ? { ...item, marks_obtained: value } : item)));
                          }}
                        />
                        <span className="cell-sub">/ {max}</span>
                      </div>
                    </td>
                    <td>{row.grade ? <Badge tone="indigo">{row.grade}</Badge> : "—"}</td>
                    <td>
                      <input
                        className="input"
                        style={{ height: 32, minHeight: 32 }}
                        value={row.remarks || ""}
                        disabled={published}
                        maxLength={255}
                        aria-label={`Remarks for ${row.student_name}`}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRows((current) => current.map((item) => (item.student_uuid === row.student_uuid ? { ...item, remarks: value } : item)));
                        }}
                        placeholder="Optional"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Users} title="No students in this section" description="Assign students to the section before entering marks." />}
        {!published && rows.length ? (
          <p className="help" style={{ padding: "10px 18px 14px", margin: 0 }}>
            Every student needs a mark between 0 and {max}. Grades are calculated automatically.
          </p>
        ) : null}
      </Card>
    </>
  );
}
