import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { EXAM_TERMS } from "../lib/constants";
import {
  ErrorBanner,
  Field,
  Modal,
  Spinner,
} from "../components/ui";

/** Create or edit the exam itself. Papers and marks live on the workspace page. */
export function ExamFormModal({ open, onClose, exam, years, onSaved }) {
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

/** Add or edit one paper (section + subject) inside an exam. */
export function ExamSubjectFormModal({ open, onClose, exam, paper, sections, subjects, onSaved }) {
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
