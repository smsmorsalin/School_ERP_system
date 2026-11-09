import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDateTime, relativeTime } from "../lib/format";
import { AUDIENCES } from "../lib/constants";
import { useDebounced, useList, useReferenceData } from "../lib/hooks";
import {
  Avatar,
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
  Toggle,
} from "../components/ui";

export default function Announcements() {
  const { user, isAdmin, hasRole } = useAuth();
  const toast = useToast();
  const canPublish = isAdmin || hasRole("Teacher");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [audience, setAudience] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const { classes, sections } = useReferenceData({ classes: canPublish, sections: canPublish });
  const list = useList("/announcements/", { ordering: "-is_pinned,-published_at" });

  useEffect(() => {
    list.update({ search: debounced, audience, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, audience]);

  const classOptions = useMemo(() => {
    if (isAdmin) return classes.map((item) => ({ uuid: item.uuid, name: item.name }));
    const map = new Map();
    sections.forEach((section) => {
      if (section.school_class_uuid) map.set(section.school_class_uuid, section.school_class_name);
    });
    return [...map.entries()].map(([uuid, name]) => ({ uuid, name }));
  }, [isAdmin, classes, sections]);

  const markRead = async (item) => {
    try {
      await api.post(`/announcements/${item.uuid}/read/`, {});
      list.setData((current) => ({
        ...current,
        results: current.results.map((row) => (row.uuid === item.uuid ? { ...row, is_read: true } : row)),
      }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await api.post("/announcements/mark-all-read/", {});
      toast.success("All announcements marked as read.");
      list.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMarkingAll(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/announcements/${deleting.uuid}/`);
      toast.success("Announcement removed.");
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
        title="Announcements"
        subtitle={canPublish ? "Share updates with the right audience" : "School news and notices"}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={markAll} disabled={markingAll}>
              {markingAll ? <Spinner size={15} /> : <CheckCheck size={16} />} Mark all read
            </button>
            {canPublish ? <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> New announcement</button> : null}
          </>
        }
      />

      <div className="filters" style={{ marginBottom: 16 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search announcements…" />
        <select className="select" value={audience} onChange={(event) => setAudience(event.target.value)}>
          <option value="">All audiences</option>
          {AUDIENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      {list.loading ? <Loading /> : list.rows.length ? (
        <>
          {list.rows.map((item) => (
            <div className={`announce-card ${item.is_read ? "" : "unread"}`} key={item.uuid}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div className="stat-icon indigo" style={{ width: 38, height: 38, flexShrink: 0 }}>
                  <Megaphone size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>
                    {item.is_pinned ? <Pin size={14} style={{ color: "var(--warning)" }} /> : null}
                    {item.title}
                    {!item.is_read ? <Badge tone="indigo">New</Badge> : null}
                    {item.audience === "class" && item.class_name ? <Badge tone="neutral">{item.class_name}</Badge> : null}
                  </h4>
                  <div className="body">{item.body}</div>
                  <div className="announce-meta">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Avatar name={item.created_by_name} size="sm" /> {item.created_by_name || "School"}
                    </span>
                    <span>{item.audience_display || item.audience}</span>
                    <span>{relativeTime(item.published_at)}</span>
                    {item.expires_at ? <span>expires {formatDateTime(item.expires_at)}</span> : null}
                    {!item.is_read ? (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => markRead(item)}>
                        Mark as read
                      </button>
                    ) : (
                      <span style={{ marginLeft: "auto", color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCheck size={13} /> Read
                      </span>
                    )}
                    {canPublish && (isAdmin || item.created_by === user?.uuid) ? (
                      <span style={{ display: "inline-flex", gap: 2, marginLeft: item.is_read ? 0 : 8 }}>
                        <button type="button" className="icon-btn" onClick={() => { setEditing(item); setFormOpen(true); }} title="Edit"><Pencil size={14} /></button>
                        <button type="button" className="icon-btn danger" onClick={() => setDeleting(item)} title="Delete"><Trash2 size={14} /></button>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Card bodyClass="flush" style={{ marginTop: 14 }}>
            <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} label="announcements" />
          </Card>
        </>
      ) : (
        <EmptyState icon={Megaphone} title="No announcements" description={canPublish ? "Publish the first update for your school." : "School updates will appear here."} />
      )}

      <AnnouncementFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        isAdmin={isAdmin}
        classOptions={classOptions}
        onSaved={() => { setFormOpen(false); list.reload(); }}
      />

      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this announcement?" message={`"${deleting?.title}" will be removed from everyone's feed.`} confirmLabel="Delete announcement" />
    </>
  );
}

function AnnouncementFormModal({ open, onClose, item, isAdmin, classOptions, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: "", body: "", audience: "all", school_class: "", is_pinned: false, is_published: true, expires_at: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const audienceOptions = isAdmin ? AUDIENCES : AUDIENCES.filter((entry) => ["students", "parents", "class"].includes(entry.value));

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? {
      title: item.title,
      body: item.body,
      audience: item.audience,
      school_class: item.school_class || "",
      is_pinned: item.is_pinned,
      is_published: item.is_published,
      expires_at: item.expires_at ? item.expires_at.slice(0, 16) : "",
    } : {
      title: "",
      body: "",
      audience: isAdmin ? "all" : "class",
      school_class: "",
      is_pinned: false,
      is_published: true,
      expires_at: "",
    });
  }, [open, item, isAdmin]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        school_class: form.audience === "class" ? form.school_class || null : null,
        expires_at: form.expires_at ? `${form.expires_at}:00` : null,
      };
      if (item) await api.patch(`/announcements/${item.uuid}/`, payload);
      else await api.post("/announcements/", payload);
      toast.success(item ? "Announcement updated." : "Announcement published.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit announcement" : "New announcement"} subtitle="Keep it clear and specific." footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form="announcement-form" className="btn btn-primary" disabled={busy}>
          {busy ? <Spinner size={15} light /> : <Megaphone size={15} />} {item ? "Save changes" : "Publish"}
        </button>
      </>
    }>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <form id="announcement-form" onSubmit={submit}>
        <Field label="Title" required>
          <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required maxLength={200} />
        </Field>
        <Field label="Message" required>
          <textarea className="textarea" rows={6} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} required />
        </Field>
        <div className="field-row">
          <Field label="Audience" required>
            <select className="select" value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}>
              {audienceOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
            </select>
          </Field>
          <Field label="Expires at" hint="Optional. The notice hides after this time.">
            <input className="input" type="datetime-local" value={form.expires_at} onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value }))} />
          </Field>
        </div>
        {form.audience === "class" ? (
          <Field label="Class" required>
            <select className="select" value={form.school_class} onChange={(event) => setForm((current) => ({ ...current, school_class: event.target.value }))} required>
              <option value="">Select class…</option>
              {classOptions.map((entry) => <option key={entry.uuid} value={entry.uuid}>{entry.name}</option>)}
            </select>
          </Field>
        ) : null}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Toggle checked={form.is_pinned} onChange={(value) => setForm((current) => ({ ...current, is_pinned: value }))} label="Pin to top" />
          <Toggle checked={form.is_published} onChange={(value) => setForm((current) => ({ ...current, is_published: value }))} label="Published" />
        </div>
        {!isAdmin ? <p className="help" style={{ marginTop: 10 }}>Teachers can publish to their own classes or to students and parents.</p> : null}
      </form>
    </Modal>
  );
}
