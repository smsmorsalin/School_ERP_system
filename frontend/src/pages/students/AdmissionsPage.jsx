import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, GraduationCap, KeyRound, UserCheck, UserPlus } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { todayISO } from "../../lib/format";
import { GENDERS } from "../../lib/constants";
import { useReferenceData } from "../../lib/hooks";
import {
  Card,
  ErrorBanner,
  Field,
  PageHeader,
  Spinner,
} from "../../components/ui";

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  date_of_birth: "",
  gender: "",
  blood_group: "",
  admission_date: todayISO(),
  current_section: "",
  roll_number: "",
  password: "",
  address: "",
  city: "",
  country: "",
};

/** Admission is a multi-part record, so it gets a full page instead of a modal. */
export default function AdmissionsPage() {
  usePageTitle("Admissions");
  const navigate = useNavigate();
  const toast = useToast();
  const { sections } = useReferenceData({ sections: true });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        ...form,
        current_section: form.current_section || null,
        roll_number: form.roll_number === "" ? null : Number(form.roll_number),
        date_of_birth: form.date_of_birth || null,
        admission_date: form.admission_date || null,
        gender: form.gender || "",
        blood_group: form.blood_group || "",
        phone_number: form.phone_number || "",
      };
      if (!payload.password) delete payload.password;
      const result = await api.post("/academics/students/", payload);
      setCreated(result);
      toast.success("Student admitted successfully.");
    } catch (err) {
      setError(err);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setForm(emptyForm);
    setCreated(null);
    setError(null);
  };

  if (created) {
    return (
      <>
        <PageHeader
          title="Student admitted"
          subtitle="The student record and sign-in account are ready."
        />
        <div className="form-page">
          <div className="form-page-main">
            <div className="form-section">
              <div className="admission-success">
                <div className="admission-success-icon">
                  <BadgeCheck size={26} />
                </div>
                <div>
                  <h3>{created.user?.full_name || `${form.first_name} ${form.last_name}`}</h3>
                  <p>Enrollment is complete. Share the sign-in details below with the family.</p>
                </div>
              </div>

              <dl className="kv admission-kv">
                <dt>Student ID</dt>
                <dd className="mono">{created.student_id}</dd>
                <dt>Sign-in email</dt>
                <dd>{created.user?.email || form.email}</dd>
                <dt>Temporary password</dt>
                <dd>
                  <code>{created.temporary_password || "Set by the family"}</code>
                </dd>
                <dt>Section</dt>
                <dd>{sections.find((item) => item.uuid === form.current_section)?.display_name || "Unassigned"}</dd>
              </dl>

              <div className="notice info" style={{ marginTop: 16 }}>
                <KeyRound size={15} /> The student must change this temporary password at first sign-in.
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={reset}>
                  <UserPlus size={15} /> Admit another
                </button>
                <Link to={`/students/${created.uuid}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                  Open student profile
                </Link>
              </div>
            </div>
          </div>
          <aside className="form-page-aside">
            <Card title="Next steps">
              <ol className="admission-steps">
                <li>Share the temporary password with the guardian.</li>
                <li>Confirm the class and section placement.</li>
                <li>Link guardians from the student profile.</li>
                <li>Check the timetable and fee structure for the class.</li>
              </ol>
            </Card>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Admit a new student"
        subtitle="Create the student record and sign-in account in one pass. Required fields are marked."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/students")}>
            <ArrowLeft size={16} /> Back to students
          </button>
        }
      />

      <div className="form-page">
        <form className="form-page-main" onSubmit={submit} id="admission-form">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          <section className="form-section">
            <div className="form-section-head">
              <span className="fs-step">1</span>
              <div>
                <h3>Student details</h3>
                <p>The name and contact information used on school records.</p>
              </div>
            </div>
            <div className="field-row">
              <Field label="First name" required>
                <input className="input" value={form.first_name} onChange={set("first_name")} required maxLength={150} />
              </Field>
              <Field label="Last name" required>
                <input className="input" value={form.last_name} onChange={set("last_name")} required maxLength={150} />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Email address" required hint="Used as the student's sign-in name.">
                <input className="input" type="email" value={form.email} onChange={set("email")} required />
              </Field>
              <Field label="Phone number">
                <input className="input" value={form.phone_number} onChange={set("phone_number")} />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Date of birth">
                <input className="input" type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
              </Field>
              <Field label="Gender">
                <select className="select" value={form.gender} onChange={set("gender")}>
                  <option value="">Not specified</option>
                  {GENDERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="field-row">
              <Field label="Blood group">
                <input className="input" value={form.blood_group} onChange={set("blood_group")} placeholder="e.g. O+" maxLength={5} />
              </Field>
              <Field label="Admission date">
                <input className="input" type="date" value={form.admission_date} onChange={set("admission_date")} />
              </Field>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="fs-step">2</span>
              <div>
                <h3>Placement</h3>
                <p>Choose the teaching group. Placement can be changed later.</p>
              </div>
            </div>
            <div className="field-row">
              <Field label="Class / section">
                <select className="select" value={form.current_section} onChange={set("current_section")}>
                  <option value="">Unassigned</option>
                  {sections.map((item) => (
                    <option key={item.uuid} value={item.uuid}>
                      {item.display_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Roll number" hint="Optional; usually assigned by the class teacher.">
                <input className="input" type="number" min="1" value={form.roll_number} onChange={set("roll_number")} />
              </Field>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="fs-step">3</span>
              <div>
                <h3>Address & access</h3>
                <p>Optional contact details and the initial sign-in password.</p>
              </div>
            </div>
            <div className="field-row">
              <Field label="City">
                <input className="input" value={form.city} onChange={set("city")} />
              </Field>
              <Field label="Country">
                <input className="input" value={form.country} onChange={set("country")} />
              </Field>
            </div>
            <Field label="Address">
              <textarea className="textarea" rows={3} value={form.address} onChange={set("address")} />
            </Field>
            <Field
              label="Initial password"
              hint="Leave blank to generate a secure temporary password. The student must change it at first sign-in."
            >
              <input className="input" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
            </Field>
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/students")} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner size={16} light /> : <UserCheck size={16} />}
              {busy ? "Admitting…" : "Admit student"}
            </button>
          </div>
        </form>

        <aside className="form-page-aside">
          <Card title="Before you start">
            <ul className="admission-checklist">
              <li>
                <GraduationCap size={14} /> Confirm the correct class and section.
              </li>
              <li>
                <UserCheck size={14} /> Check that the email is not already in use.
              </li>
              <li>
                <KeyRound size={14} /> Decide whether to set a password or generate one.
              </li>
            </ul>
          </Card>
          <Card title="What happens next" style={{ marginTop: 12 }}>
            <ol className="admission-steps">
              <li>A student record and user account are created together.</li>
              <li>Guardians can be linked from the student profile.</li>
              <li>Fees and attendance follow the assigned section.</li>
            </ol>
          </Card>
        </aside>
      </div>
    </>
  );
}
