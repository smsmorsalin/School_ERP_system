import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
  Unlock,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, formatTime } from "../lib/format";
import { EXAM_TERMS } from "../lib/constants";
import { useAll, useDebounced, useList, useReferenceData } from "../lib/hooks";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Spinner,
  StatusBadge,
  Tabs,
  Toggle,
} from "../components/ui";
import { DonutChart, palette } from "../components/charts";

export default function Exams() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [published, setPublished] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [managing, setManaging] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { years } = useReferenceData({ years: true });
  const list = useList("/exams/", { ordering: "-start_date" });

  useEffect(() => {
    list.update({ search: debounced, is_published: published, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, published]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/exams/${deleting.uuid}/`);
      toast.success("Exam deleted.");
      setDeleting(null);
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Examinations"
        subtitle="Create exams, add papers, enter marks and publish results"
        actions={
          isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={16} /> New exam
            </button>
          ) : null
        }
      />

      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search exams…" />
          <select className="select" value={published} onChange={(event) => setPublished(event.target.value)}>
            <option value="">All exams</option>
            <option value="true">Published only</option>
            <option value="false">Drafts only</option>
          </select>
        </div>

        {list.loading ? <Loading /> : list.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Exam</th><th>Term</th><th>Dates</th><th>Papers</th><th>Sections</th><th>Results</th><th>Status</th><th className="actions">Actions</th></tr>
                </thead>
                <tbody>
                  {list.rows.map((exam) => (
                    <tr key={exam.uuid}>
                      <td>
                        <div className="cell-main">{exam.name}</div>
                        <div className="cell-sub">{exam.academic_year_name}</div>
                      </td>
                      <td><Badge tone="neutral">{exam.term?.replace("_", " ")}</Badge></td>
                      <td className="cell-sub">{formatDate(exam.start_date)} – {formatDate(exam.end_date)}</td>
                      <td>{exam.subject_count}</td>
                      <td>{exam.section_count}</td>
                      <td>{exam.result_count}</td>
                      <td><StatusBadge status={exam.is_published ? "published" : "pending"}>{exam.is_published ? "Published" : "Draft"}</StatusBadge></td>
                      <td className="actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setManaging(exam)}>
                          <ClipboardList size={14} /> Manage
                        </button>
                        {isAdmin ? (
                          <>
                            <button type="button" className="icon-btn" onClick={() => { setEditing(exam); setFormOpen(true); }} title="Edit exam"><Pencil size={15} /></button>
                            <button type="button" className="icon-btn danger" onClick={() => setDeleting(exam)} title="Delete exam"><Trash2 size={15} /></button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="exams" />
          </>
        ) : (
          <EmptyState icon={ClipboardList} title="No exams found" description={isAdmin ? "Create the first exam for this academic year." : "You have no exams assigned yet."} />
        )}
      </Card>

      <ExamFormModal open={formOpen} onClose={() => setFormOpen(false)} exam={editing} years={years} onSaved={() => { setFormOpen(false); list.reload(); }} />

      {managing ? (
        <ExamManageModal
          exam={managing}
          isAdmin={isAdmin}
          onClose={() => { setManaging(null); list.reload(); }}
          onUpdated={(updated) => setManaging(updated)}
        />
      ) : null}

      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this exam?" message={`${deleting?.name} and all of its papers and results will be removed. This cannot be undone.`} confirmLabel="Delete exam" />
    </>
  );
}

function ExamFormModal({ open, onClose, exam, years, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", academic_year: "", term: "mid_term", start_date: "", end_date: "", description: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(exam ? {
      name: exam.name,
      academic_year: exam.academic_year,
      term: exam.term,
      start_date: exam.start_date,
      end_date: exam.end_date,
      description: exam.description || "",
    } : {
      name: "",
      academic_year: years.find((year) => year.is_current)?.uuid || years[0]?.uuid || "",
      term: "mid_term",
      start_date: "",
      end_date: "",
      description: "",
    });
  }, [open, exam, years]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (exam) await api.patch(`/exams/${exam.uuid}/`, form);
      else await api.post("/exams/", form);
      toast.success(exam ? "Exam updated." : "Exam created.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={exam ? "Edit exam" : "Create exam"} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="exam-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="exam-form" onSubmit={submit}>
        <Field label="Exam name" required>
          <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </Field>
        <div className="field-row">
          <Field label="Academic year" required>
            <select className="select" value={form.academic_year} onChange={(event) => setForm((current) => ({ ...current, academic_year: event.target.value }))} required>
              <option value="">Select year…</option>
              {years.map((year) => <option key={year.uuid} value={year.uuid}>{year.name}{year.is_current ? " (current)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Term" required>
            <select className="select" value={form.term} onChange={(event) => setForm((current) => ({ ...current, term: event.target.value }))}>
              {EXAM_TERMS.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Start date" required>
            <input className="input" type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} required />
          </Field>
          <Field label="End date" required>
            <input className="input" type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} required />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="textarea" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>
      </form>
    </Modal>
  );
}

function ExamManageModal({ exam, isAdmin, onClose, onUpdated }) {
  const toast = useToast();
  const [tab, setTab] = useState("papers");
  const [addOpen, setAddOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState(null);
  const [marking, setMarking] = useState(null);
  const [deletingPaper, setDeletingPaper] = useState(null);
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const papers = useAll("/exam-subjects/", { exam: exam.uuid, ordering: "section__school_class__level,subject__name" }, { enabled: true });
  const analytics = useFetch(`/exams/analytics/?exam=${exam.uuid}`, { deps: [exam.uuid] });
  const { sections, subjects } = useReferenceData({ sections: true, subjects: true });

  const togglePublish = async () => {
    setPublishBusy(true);
    try {
      const result = await api.post(`/exams/${exam.uuid}/publish/`, { published: !exam.is_published });
      toast.success(result.detail);
      onUpdated({ ...exam, is_published: result.is_published });
      papers.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPublishBusy(false);
    }
  };

  const removePaper = async () => {
    setBusy(true);
    try {
      await api.delete(`/exam-subjects/${deletingPaper.uuid}/`);
      toast.success("Paper removed.");
      setDeletingPaper(null);
      papers.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={exam.name}
        subtitle={`${exam.term?.replace("_", " ")} · ${formatDate(exam.start_date)} – ${formatDate(exam.end_date)}`}
        size="modal-xl"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            {isAdmin ? (
              <button type="button" className="btn btn-primary" onClick={togglePublish} disabled={publishBusy}>
                {publishBusy ? <Spinner size={15} light /> : exam.is_published ? <Unlock size={15} /> : <Send size={15} />}
                {exam.is_published ? "Unpublish results" : "Publish results"}
              </button>
            ) : null}
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <StatusBadge status={exam.is_published ? "published" : "pending"}>{exam.is_published ? "Published" : "Draft"}</StatusBadge>
          <Badge tone="neutral">{exam.subject_count} papers</Badge>
          <Badge tone="neutral">{exam.result_count} results</Badge>
          {exam.is_published ? (
            <span className="notice warning" style={{ padding: "5px 10px", marginLeft: "auto" }}>
              <Lock size={13} /> Results are locked while published.
            </span>
          ) : null}
        </div>

        <Tabs
          tabs={[
            { value: "papers", label: "Papers", count: papers.data.length },
            { value: "analytics", label: "Analytics" },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "papers" ? (
          <>
            {isAdmin ? (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditingPaper(null); setAddOpen(true); }}>
                  <Plus size={14} /> Add paper
                </button>
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
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMarking(paper)} disabled={exam.is_published}>
                            <ClipboardList size={13} /> Marks
                          </button>
                          {isAdmin ? (
                            <>
                              <button type="button" className="icon-btn" onClick={() => { setEditingPaper(paper); setAddOpen(true); }}><Pencil size={14} /></button>
                              <button type="button" className="icon-btn danger" onClick={() => setDeletingPaper(paper)}><Trash2 size={14} /></button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={ClipboardList} title="No papers yet" description={isAdmin ? "Add subjects and sections to this exam." : "No papers are assigned to you."} />}
          </>
        ) : (
          analytics.loading ? <Loading /> : analytics.data ? (
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
              </div>
            </div>
          ) : <EmptyState icon={BarChart3} title="No analytics yet" description="Enter marks to see grade distribution." />
        )}
      </Modal>

      <ExamSubjectFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        exam={exam}
        paper={editingPaper}
        sections={sections}
        subjects={subjects}
        onSaved={() => { setAddOpen(false); papers.reload(); }}
      />

      {marking ? (
        <MarkEntryModal
          paper={marking}
          published={exam.is_published}
          onClose={() => { setMarking(null); papers.reload(); analytics.reload(); }}
        />
      ) : null}

      <ConfirmDialog open={Boolean(deletingPaper)} onClose={() => setDeletingPaper(null)} onConfirm={removePaper} busy={busy} title="Remove this paper?" message={`${deletingPaper?.subject_name} for ${deletingPaper?.section_name} will be removed along with its results.`} confirmLabel="Remove paper" />
    </>
  );
}

function ExamSubjectFormModal({ open, onClose, exam, paper, sections, subjects, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ section: "", subject: "", exam_date: "", start_time: "", max_marks: 100, pass_marks: 40 });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(paper ? {
      section: paper.section,
      subject: paper.subject,
      exam_date: paper.exam_date || "",
      start_time: paper.start_time?.slice(0, 5) || "",
      max_marks: paper.max_marks,
      pass_marks: paper.pass_marks,
    } : {
      section: "",
      subject: "",
      exam_date: exam.start_date,
      start_time: "",
      max_marks: 100,
      pass_marks: 40,
    });
  }, [open, paper, exam]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        exam: exam.uuid,
        section: form.section,
        subject: form.subject,
        exam_date: form.exam_date || null,
        start_time: form.start_time || null,
        max_marks: Number(form.max_marks),
        pass_marks: Number(form.pass_marks),
      };
      if (paper) await api.patch(`/exam-subjects/${paper.uuid}/`, payload);
      else await api.post("/exam-subjects/", payload);
      toast.success(paper ? "Paper updated." : "Paper added.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={paper ? "Edit paper" : "Add paper"} subtitle={exam.name} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="paper-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="paper-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="Section" required>
            <select className="select" value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} required>
              <option value="">Select section…</option>
              {sections.map((section) => <option key={section.uuid} value={section.uuid}>{section.display_name}</option>)}
            </select>
          </Field>
          <Field label="Subject" required>
            <select className="select" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} required>
              <option value="">Select subject…</option>
              {subjects.map((subject) => <option key={subject.uuid} value={subject.uuid}>{subject.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Exam date" hint={`Within ${formatDate(exam.start_date)} – ${formatDate(exam.end_date)}`}>
            <input className="input" type="date" value={form.exam_date} min={exam.start_date} max={exam.end_date} onChange={(event) => setForm((current) => ({ ...current, exam_date: event.target.value }))} />
          </Field>
          <Field label="Start time">
            <input className="input" type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Maximum marks" required>
            <input className="input" type="number" min="1" value={form.max_marks} onChange={(event) => setForm((current) => ({ ...current, max_marks: event.target.value }))} required />
          </Field>
          <Field label="Pass marks" required>
            <input className="input" type="number" min="0" value={form.pass_marks} onChange={(event) => setForm((current) => ({ ...current, pass_marks: event.target.value }))} required />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function MarkEntryModal({ paper, published, onClose }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const max = Number(paper.max_marks);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/exam-subjects/${paper.uuid}/sheet/`);
      setRows((data.rows || []).map((row) => ({ ...row, marks_obtained: row.marks_obtained ?? "" })));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.uuid]);

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
    setError(null);
    try {
      const result = await api.post(`/exam-subjects/${paper.uuid}/bulk-results/`, {
        results: rows.map((row) => ({
          student: row.student_uuid,
          marks_obtained: Number(row.marks_obtained),
          remarks: row.remarks || "",
        })),
      });
      toast.success(`${result.created} created, ${result.updated} updated.`, "Marks saved");
      load();
    } catch (err) {
      setError(err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Marks · ${paper.subject_name}`}
      subtitle={`${paper.section_name} · max ${paper.max_marks} · pass ${paper.pass_marks}`}
      size="modal-lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Close</button>
          {!published ? (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !valid}>
              {saving ? <Spinner size={15} light /> : <CheckCircle2 size={15} />}
              {saving ? "Saving…" : "Save marks"}
            </button>
          ) : null}
        </>
      }
    >
      {published ? (
        <div className="notice warning" style={{ marginBottom: 14 }}><Lock size={15} /> This exam is published, so marks are read-only.</div>
      ) : null}
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <Loading label="Loading roster…" /> : rows.length ? (
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
                      value={row.remarks}
                      disabled={published}
                      maxLength={255}
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
      ) : <EmptyState icon={Users} title="No students in this section" />}
      {!published && rows.length ? (
        <p className="help" style={{ marginTop: 10 }}>
          Every student needs a mark between 0 and {max}. Grades are calculated automatically.
        </p>
      ) : null}
    </Modal>
  );
}
