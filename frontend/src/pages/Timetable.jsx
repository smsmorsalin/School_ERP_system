import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatTime } from "../lib/format";
import { DAYS } from "../lib/constants";
import { useAll, useReferenceData } from "../lib/hooks";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Spinner,
} from "../components/ui";

export default function Timetable() {
  const { isAdmin } = useAuth();
  const [section, setSection] = useState("");
  const { sections } = useReferenceData({ sections: true });
  const list = useAll("/academics/timetable/", { section, ordering: "day_of_week,start_time" }, { enabled: Boolean(section) });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!section && sections.length) setSection(sections[0].uuid);
  }, [sections, section]);

  const byDay = useMemo(() => {
    const groups = Object.fromEntries(DAYS.map((day) => [day.value, []]));
    list.data.forEach((entry) => {
      if (groups[entry.day_of_week]) groups[entry.day_of_week].push(entry);
    });
    Object.values(groups).forEach((entries) => entries.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return groups;
  }, [list.data]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/academics/timetable/${deleting.uuid}/`);
      toast.success("Timetable entry removed.");
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
        title="Timetable"
        subtitle="Weekly schedule by class section"
        actions={
          isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!section}>
              <Plus size={16} /> Add period
            </button>
          ) : null
        }
      />

      <Card flush>
        <div className="filters" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <CalendarDays size={17} style={{ color: "var(--muted)" }} />
          <select className="select" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">Select a section…</option>
            {sections.map((item) => <option key={item.uuid} value={item.uuid}>{item.display_name}</option>)}
          </select>
          {section ? <span className="cell-sub">{(list.data || []).length} periods per week</span> : null}
        </div>

        {!section ? (
          <EmptyState icon={CalendarDays} title="Choose a section" description="Select a class section to view its weekly timetable." />
        ) : list.loading ? (
          <Loading />
        ) : list.error ? (
          <div style={{ padding: 18 }}><ErrorBanner error={list.error} /></div>
        ) : list.data.length ? (
          <div className="table-wrap" style={{ padding: 12 }}>
            <table className="timetable-grid">
              <thead>
                <tr>{DAYS.map((day) => <th key={day.value}>{day.label}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  {DAYS.map((day) => (
                    <td key={day.value}>
                      {byDay[day.value].length ? byDay[day.value].map((entry) => (
                        <div className="tt-slot filled" key={entry.uuid} style={{ marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                            <strong style={{ flex: 1 }}>{entry.subject_name}</strong>
                            {isAdmin ? (
                              <span style={{ display: "flex" }}>
                                <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => { setEditing(entry); setFormOpen(true); }} title="Edit"><Pencil size={12} /></button>
                                <button type="button" className="icon-btn danger" style={{ width: 22, height: 22 }} onClick={() => setDeleting(entry)} title="Delete"><Trash2 size={12} /></button>
                              </span>
                            ) : null}
                          </div>
                          <div className="tt-time"><Clock size={10} style={{ verticalAlign: -1 }} /> {formatTime(entry.start_time)} – {formatTime(entry.end_time)}</div>
                          {entry.teacher_name ? <div className="tt-room">{entry.teacher_name}</div> : null}
                          {entry.room ? <div className="tt-room"><MapPin size={10} style={{ verticalAlign: -1 }} /> {entry.room}</div> : null}
                        </div>
                      )) : (
                        <div className="tt-slot" style={{ display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 10.5 }}>—</div>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="No periods scheduled" description="Add the first period for this section." />
        )}
      </Card>

      <TimetableFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        section={section}
        onSaved={() => { setFormOpen(false); list.reload(); }}
      />

      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Remove this period?" message={`${deleting?.subject_name || "This period"} will be removed from the timetable.`} confirmLabel="Remove period" />
    </>
  );
}

function TimetableFormModal({ open, onClose, item, section, onSaved }) {
  const toast = useToast();
  const { sections, subjects } = useReferenceData({ sections: true, subjects: true });
  const { data: teachers } = useAll("/accounts/users/", { role: "Teacher" }, { enabled: open });
  const [form, setForm] = useState({ section: "", subject: "", teacher: "", day_of_week: 0, start_time: "08:00", end_time: "08:45", room: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? {
      section: item.section,
      subject: item.subject,
      teacher: item.teacher || "",
      day_of_week: item.day_of_week,
      start_time: item.start_time?.slice(0, 5) || "08:00",
      end_time: item.end_time?.slice(0, 5) || "08:45",
      room: item.room || "",
    } : {
      section: section || "",
      subject: "",
      teacher: "",
      day_of_week: 0,
      start_time: "08:00",
      end_time: "08:45",
      room: "",
    });
  }, [open, item, section]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, teacher: form.teacher || null, day_of_week: Number(form.day_of_week) };
      if (item) await api.patch(`/academics/timetable/${item.uuid}/`, payload);
      else await api.post("/academics/timetable/", payload);
      toast.success(item ? "Period updated." : "Period added.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit period" : "Add period"} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="tt-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={15} light /> : null} Save</button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="tt-form" onSubmit={submit}>
        <div className="field-row">
          <Field label="Section" required>
            <select className="select" value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} required>
              <option value="">Select section…</option>
              {sections.map((item2) => <option key={item2.uuid} value={item2.uuid}>{item2.display_name}</option>)}
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
          <Field label="Day" required>
            <select className="select" value={form.day_of_week} onChange={(event) => setForm((current) => ({ ...current, day_of_week: event.target.value }))}>
              {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </Field>
          <Field label="Teacher">
            <select className="select" value={form.teacher} onChange={(event) => setForm((current) => ({ ...current, teacher: event.target.value }))}>
              <option value="">Unassigned</option>
              {teachers.map((teacher) => <option key={teacher.uuid} value={teacher.uuid}>{teacher.full_name}</option>)}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Start time" required>
            <input className="input" type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} required />
          </Field>
          <Field label="End time" required>
            <input className="input" type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} required />
          </Field>
        </div>
        <Field label="Room">
          <input className="input" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="e.g. 204" />
        </Field>
      </form>
    </Modal>
  );
}
