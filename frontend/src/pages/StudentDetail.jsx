import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Pencil,
  Plus,
  Receipt,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../lib/usePageTitle";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, percent } from "../lib/format";
import { RELATIONS } from "../lib/constants";
import { useReferenceData } from "../lib/hooks";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Card,
  Checkbox,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Spinner,
  StatCard,
  StatusBadge,
} from "../components/ui";
import { StudentFormModal } from "./Students";

/**
 * Student profile as a first-class page. The student directory links here, so
 * enrollment, guardians and related records get room to breathe instead of
 * living inside a modal.
 */
export default function StudentDetail() {
  const { uuid } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [student, setStudent] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [parents, setParents] = useState([]);
  const [guardianForm, setGuardianForm] = useState({ user: "", relation: "guardian", is_primary: false });
  const [guardianBusy, setGuardianBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const { sections } = useReferenceData({ sections: true });
  usePageTitle(student?.user?.full_name || "Student profile");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/academics/students/${uuid}/`);
      setStudent(data);
      if (isAdmin && data.user?.uuid) {
        api.get(`/accounts/users/${data.user.uuid}/`).then(setUserDetail).catch(() => {});
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get("/accounts/users/", { role: "Parent", page_size: 100 })
      .then((data) => setParents(data.results || []))
      .catch(() => {});
  }, [isAdmin]);

  const addGuardian = async () => {
    if (!guardianForm.user) return;
    setGuardianBusy(true);
    try {
      await api.post(`/academics/students/${uuid}/guardians/`, guardianForm);
      toast.success("Guardian linked to the student.");
      await load();
      setGuardianForm({ user: "", relation: "guardian", is_primary: false });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardianBusy(false);
    }
  };

  const name = student?.user?.full_name || "Student";

  return (
    <>
      <Breadcrumbs items={[{ label: "Students", to: "/students" }, { label: name }]} />

      {loading ? (
        <Loading label="Loading student record…" />
      ) : error ? (
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      ) : !student ? (
        <Card>
          <EmptyState title="Student not found" description="The record may have been archived or removed." />
        </Card>
      ) : (
        <>
          <div className="detail-hero">
            <Avatar name={name} src={student.user?.profile_image_url} size="lg" />
            <div className="detail-hero-main">
              <h2>{name}</h2>
              <p>{student.user?.email}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <StatusBadge status={student.status} />
                {student.gender ? <Badge tone="neutral">{student.gender}</Badge> : null}
                {student.blood_group ? <Badge tone="red">{student.blood_group}</Badge> : null}
                {student.class_name ? <Badge tone="indigo">{student.class_name}{student.section_name ? ` · ${student.section_name}` : ""}</Badge> : null}
              </div>
            </div>
            {isAdmin ? (
              <div className="detail-hero-actions">
                <button type="button" className="btn btn-primary" onClick={() => setEditOpen(true)}>
                  <Pencil size={16} /> Edit details
                </button>
              </div>
            ) : null}
          </div>

          <div className="stat-grid">
            <StatCard
              icon={CalendarCheck}
              label="Attendance"
              value={student.attendance_rate == null ? "—" : percent(student.attendance_rate, 0)}
              hint="all recorded sessions"
              tone="emerald"
            />
            <StatCard icon={ClipboardList} label="Roll number" value={student.roll_number ?? "—"} hint="current section" tone="indigo" />
            <StatCard icon={UserRound} label="Admitted" value={formatDate(student.admission_date)} hint="enrollment date" tone="cyan" />
            <StatCard icon={Receipt} label="Student ID" value={student.student_id} hint="school identifier" tone="amber" />
          </div>

          <div className="detail-grid" style={{ marginBottom: 20 }}>
            <Card title="Enrollment" subtitle="Class placement and school record">
              <dl className="kv">
                <dt>Student ID</dt><dd>{student.student_id}</dd>
                <dt>Class</dt><dd>{student.class_name || "—"}</dd>
                <dt>Section</dt><dd>{student.section_name || "—"}</dd>
                <dt>Roll number</dt><dd>{student.roll_number ?? "—"}</dd>
                <dt>Admitted</dt><dd>{formatDate(student.admission_date)}</dd>
                <dt>Status</dt><dd><StatusBadge status={student.status} /></dd>
              </dl>
            </Card>

            <Card title="Contact" subtitle="Student account and personal details">
              <dl className="kv">
                <dt>Email</dt><dd>{student.user?.email || "—"}</dd>
                <dt>Phone</dt><dd>{userDetail?.phone_number || "—"}</dd>
                <dt>Date of birth</dt><dd>{userDetail?.date_of_birth ? formatDate(userDetail.date_of_birth) : "—"}</dd>
                <dt>City</dt><dd>{userDetail?.city || "—"}</dd>
                <dt>Country</dt><dd>{userDetail?.country || "—"}</dd>
              </dl>
            </Card>
          </div>

          <Card title="Guardians" subtitle="Parents and guardians linked to this student" className="detail-block">
            {student.guardians?.length ? (
              <div style={{ display: "grid", gap: 8, marginBottom: isAdmin ? 16 : 0 }}>
                {student.guardians.map((guardian) => (
                  <div
                    key={guardian.uuid}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}
                  >
                    <Avatar name={guardian.full_name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {guardian.full_name}
                        {guardian.is_primary ? <Badge tone="indigo">Primary</Badge> : null}
                      </div>
                      <div className="cell-sub">
                        {guardian.relation} · {guardian.email}
                        {guardian.phone_number ? ` · ${guardian.phone_number}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: isAdmin ? 16 : 0 }}>No guardian linked yet.</p>
            )}

            {isAdmin ? (
              <div style={{ padding: 12, border: "1px dashed var(--border-strong)", borderRadius: 10, background: "var(--surface-2)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Link an existing parent account</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <Field label="Parent account">
                      <select
                        className="select"
                        value={guardianForm.user}
                        onChange={(event) => setGuardianForm((current) => ({ ...current, user: event.target.value }))}
                      >
                        <option value="">Select parent account…</option>
                        {parents.map((parent) => (
                          <option key={parent.uuid} value={parent.uuid}>{parent.full_name} ({parent.email})</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div style={{ width: 150 }}>
                    <Field label="Relationship">
                      <select
                        className="select"
                        value={guardianForm.relation}
                        onChange={(event) => setGuardianForm((current) => ({ ...current, relation: event.target.value }))}
                      >
                        {RELATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ paddingBottom: 15 }}>
                    <Checkbox
                      checked={guardianForm.is_primary}
                      onChange={(value) => setGuardianForm((current) => ({ ...current, is_primary: value }))}
                      label="Primary"
                    />
                  </div>
                  <div style={{ paddingBottom: 15 }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addGuardian} disabled={!guardianForm.user || guardianBusy}>
                      {guardianBusy ? <Spinner size={14} light /> : <Plus size={14} />} Link guardian
                    </button>
                  </div>
                </div>
                <p className="help" style={{ marginTop: 4 }}>
                  Parents need an account with the Parent role. Create one under User accounts first.
                </p>
              </div>
            ) : null}
          </Card>

          <Card title="Related records" subtitle="Jump to this student's activity across the school" className="detail-block">
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { to: "/attendance/records", label: "Attendance history", hint: "Daily register and trends", icon: CalendarCheck },
                { to: "/results", label: "Exam results", hint: "Marks, grades and report cards", icon: ClipboardList },
                { to: `/invoices?student=${student.uuid}`, label: "Fee invoices", hint: "Bills, payments and balances", icon: Receipt },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className="cell-user" style={{ textDecoration: "none" }}>
                    <span className="stat-icon indigo" style={{ width: 34, height: 34 }}><Icon size={16} /></span>
                    <span style={{ flex: 1 }}>
                      <span className="cell-main" style={{ display: "block" }}>{item.label}</span>
                      <span className="cell-sub">{item.hint}</span>
                    </span>
                    <ChevronRight size={16} style={{ color: "var(--muted)" }} />
                  </Link>
                );
              })}
            </div>
          </Card>

          <StudentFormModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            student={student}
            sections={sections}
            onSaved={() => {
              setEditOpen(false);
              load();
            }}
          />
        </>
      )}
    </>
  );
}
