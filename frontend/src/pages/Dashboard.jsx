import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Banknote,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Clock,
  GraduationCap,
  Megaphone,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  compactMoney,
  formatDate,
  formatDateTime,
  money,
  percent,
  relativeTime,
} from "../lib/format";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
  RoleBadge,
  StatCard,
  StatusBadge,
  labelize,
} from "../components/ui";
import { AreaChart, DonutChart, palette } from "../components/charts";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function attendancePoints(daily = []) {
  return daily.map((row) => ({
    label: new Date(row.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    value: row.rate,
  }));
}

function trendPoints(trend = []) {
  return trend.map((row) => ({ label: row.month, value: Number(row.total) || 0 }));
}

export default function Dashboard() {
  const { user, isAdmin, hasRole } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "Dashboard · School ERP";
    let active = true;
    api
      .get("/dashboard/overview/")
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Loading label="Preparing your dashboard…" />;
  if (error) return <ErrorBanner error={error} />;
  if (!data) return <EmptyState title="No dashboard data" />;

  const staff = isAdmin || hasRole("Teacher");
  const stats = data.stats || {};
  const fees = data.fees || {};
  const attendance = data.attendance || {};

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.first_name || user?.full_name?.split(" ")[0] || "there"} 👋`}
        subtitle={`Here is what is happening at school · ${formatDate(new Date(), {
          weekday: "long",
        })}`}
        actions={
          <>
            <RoleBadge role={user?.primary_role} />
            {isAdmin ? (
              <Link to="/students?new=1" className="btn btn-primary">
                <UserPlus size={16} /> Admit student
              </Link>
            ) : null}
            {hasRole("Teacher") ? (
              <Link to="/attendance" className="btn btn-primary">
                <CalendarCheck size={16} /> Mark attendance
              </Link>
            ) : null}
            {hasRole("Accountant") ? (
              <Link to="/invoices" className="btn btn-primary">
                <Receipt size={16} /> Record payment
              </Link>
            ) : null}
          </>
        }
      />

      {isAdmin ? <AdminDashboard data={data} stats={stats} fees={fees} attendance={attendance} navigate={navigate} /> : null}
      {!isAdmin && hasRole("Teacher") ? (
        <TeacherDashboard data={data} stats={stats} attendance={attendance} navigate={navigate} />
      ) : null}
      {!isAdmin && hasRole("Accountant") && !hasRole("Teacher") ? (
        <AccountantDashboard data={data} stats={stats} fees={fees} navigate={navigate} />
      ) : null}
      {!isAdmin && hasRole("Student", "Parent") && !hasRole("Teacher", "Accountant") ? (
        <FamilyDashboard data={data} stats={stats} fees={fees} attendance={attendance} navigate={navigate} />
      ) : null}

      <div className="grid-main-side" style={{ marginTop: 22 }}>
        <Card
          title="Latest announcements"
          subtitle={`${data.unread_announcements || 0} unread`}
          actions={
            <Link to="/announcements" className="btn btn-ghost btn-sm">
              View all <ArrowUpRight size={14} />
            </Link>
          }
          flush
        >
          {data.announcements?.length ? (
            <div style={{ padding: 16 }}>
              {data.announcements.map((item) => (
                <Link
                  key={item.uuid}
                  to="/announcements"
                  style={{ display: "block", padding: "11px 12px", borderRadius: 10, background: "var(--surface-2)", marginBottom: 8 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {item.is_pinned ? <Badge tone="amber">Pinned</Badge> : null}
                    <strong style={{ fontSize: 13, color: "var(--text)" }}>{item.title}</strong>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
                      {relativeTime(item.published_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {labelize(item.audience)} audience
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Megaphone} title="No announcements" description="School updates will appear here." />
          )}
        </Card>

        <Card title="Upcoming exams" subtitle="Next assessments on the calendar" flush>
          {data.upcoming_exams?.length ? (
            <div>
              {data.upcoming_exams.map((exam) => (
                <div
                  key={exam.uuid}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--border)" }}
                >
                  <div className="stat-icon indigo" style={{ width: 38, height: 38 }}>
                    <CalendarClock size={17} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{exam.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {exam.term} · {formatDate(exam.start_date)} – {formatDate(exam.end_date)}
                    </div>
                  </div>
                  <StatusBadge status={exam.is_published ? "published" : "pending"}>
                    {exam.is_published ? "Published" : "Draft"}
                  </StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarClock} title="No upcoming exams" description="Scheduled exams will show up here." />
          )}
        </Card>
      </div>
    </>
  );
}

function AdminDashboard({ data, stats, fees, attendance }) {
  const navigate = useNavigate();
  const collectRate = fees.billed ? Math.round((fees.collected / fees.billed) * 100) : 0;
  return (
    <>
      <div className="stat-grid">
        <StatCard icon={GraduationCap} label="Active students" value={stats.students ?? 0} hint={`${stats.sections ?? 0} sections`} tone="indigo" />
        <StatCard icon={Users} label="Teaching staff" value={stats.teachers ?? 0} hint={`${stats.classes ?? 0} classes`} tone="emerald" />
        <StatCard icon={CalendarCheck} label="Attendance today" value={percent(stats.attendance_today_rate)} hint={`${attendance.present ?? 0} present of ${attendance.total ?? 0}`} tone="cyan" />
        <StatCard icon={Wallet} label="Fees collected" value={compactMoney(fees.collected)} hint={`${collectRate}% of ${compactMoney(fees.billed)} billed`} tone="amber" />
      </div>

      <div className="grid-main-side">
        <Card title="Fee collection" subtitle="Monthly payments received" actions={<Link to="/payments" className="btn btn-ghost btn-sm">Details</Link>}>
          {data.collection_trend?.length ? (
            <AreaChart data={trendPoints(data.collection_trend)} color="#4f46e5" formatValue={(value) => compactMoney(value)} />
          ) : (
            <EmptyState icon={Banknote} title="No payments yet" description="Collections will appear as payments are recorded." />
          )}
        </Card>

        <div style={{ display: "grid", gap: 20 }}>
          <Card title="Outstanding fees" subtitle={`${fees.overdue_count ?? 0} overdue invoice(s)`}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: "-0.03em" }}>{money(fees.outstanding)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>across {fees.invoice_count ?? 0} invoices</div>
              </div>
              <Badge tone={fees.overdue_count ? "red" : "green"}>
                {money(fees.overdue_amount)} overdue
              </Badge>
            </div>
            <div className="progress amber" style={{ marginTop: 14 }}>
              <span style={{ width: `${collectRate}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
              <span>{collectRate}% collected</span>
              <span>{money(fees.collected)} / {money(fees.billed)}</span>
            </div>
          </Card>

          <Card title="Grade distribution" subtitle="Across all published results">
            {data.grade_distribution?.length ? (
              <DonutChart
                data={data.grade_distribution.map((row, index) => ({
                  label: `Grade ${row.grade}`,
                  value: row.count,
                  color: palette[index % palette.length],
                }))}
                centerLabel="Results"
                centerValue={data.grade_distribution.reduce((sum, row) => sum + row.count, 0)}
              />
            ) : (
              <EmptyState icon={ClipboardList} title="No results yet" description="Grades appear after marks are entered." />
            )}
          </Card>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <Card title="Attendance trend" subtitle="Last 14 days">
          {attendance.daily?.length ? (
            <AreaChart data={attendancePoints(attendance.daily)} color="#06b6d4" formatValue={(value) => `${Math.round(value)}%`} />
          ) : (
            <EmptyState icon={CalendarCheck} title="No attendance recorded" />
          )}
        </Card>
        <Card title="Recently admitted" subtitle="Newest students" actions={<Link to="/students" className="btn btn-ghost btn-sm">All students</Link>} flush>
          {data.recent_admissions?.length ? (
            <div className="table-wrap">
              <table className="table table-compact">
                <thead>
                  <tr><th>Student</th><th>Section</th><th>Admitted</th></tr>
                </thead>
                <tbody>
                  {data.recent_admissions.map((student) => (
                    <tr key={student.uuid} style={{ cursor: "pointer" }} onClick={() => navigate(`/students?student=${student.uuid}`)}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={student.name} size="sm" />
                          <div>
                            <div className="cell-main">{student.name}</div>
                            <div className="cell-sub">{student.student_id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{student.section || "—"}</td>
                      <td className="cell-sub">{formatDate(student.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={GraduationCap} title="No admissions yet" />
          )}
        </Card>
      </div>
    </>
  );
}

function TeacherDashboard({ data, stats, attendance }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard icon={BookOpen} label="My sections" value={stats.my_sections ?? 0} tone="indigo" />
        <StatCard icon={GraduationCap} label="My students" value={stats.my_students ?? 0} tone="emerald" />
        <StatCard icon={CalendarCheck} label="Marked today" value={stats.marked_today ?? 0} hint="attendance records" tone="cyan" />
        <StatCard icon={ClipboardList} label="Marks pending" value={stats.pending_marks ?? 0} hint="results to enter" tone="amber" />
      </div>

      <div className="grid-main-side">
        <Card title="Attendance trend" subtitle="Your sections · last 14 days">
          {attendance.daily?.length ? (
            <AreaChart data={attendancePoints(attendance.daily)} color="#06b6d4" formatValue={(value) => `${Math.round(value)}%`} />
          ) : (
            <EmptyState icon={CalendarCheck} title="No attendance yet" description="Start by marking today's attendance." />
          )}
        </Card>
        <Card title="My sections" subtitle="Tap a section to mark attendance" flush>
          {data.sections?.length ? (
            data.sections.map((section) => (
              <Link
                key={section.uuid}
                to={`/attendance?section=${section.uuid}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--border)" }}
              >
                <div className="stat-icon indigo" style={{ width: 38, height: 38 }}>
                  <BookOpen size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{section.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{section.students} students</div>
                </div>
                <ArrowUpRight size={15} style={{ color: "var(--muted)" }} />
              </Link>
            ))
          ) : (
            <EmptyState title="No sections assigned" description="Ask an administrator to assign your classes." />
          )}
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <Card title="Grade distribution" subtitle="Your students">
          {data.grade_distribution?.length ? (
            <DonutChart
              data={data.grade_distribution.map((row, index) => ({ label: `Grade ${row.grade}`, value: row.count, color: palette[index % palette.length] }))}
              centerLabel="Results"
            />
          ) : (
            <EmptyState icon={ClipboardList} title="No grades yet" />
          )}
        </Card>
        <Card title="Quick actions">
          <div style={{ display: "grid", gap: 10 }}>
            <Link to="/attendance" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}><CalendarCheck size={16} /> Mark attendance</Link>
            <Link to="/exams" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}><ClipboardList size={16} /> Enter exam marks</Link>
            <Link to="/students" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}><GraduationCap size={16} /> View my students</Link>
            <Link to="/announcements" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}><Megaphone size={16} /> Post an announcement</Link>
          </div>
        </Card>
      </div>
    </>
  );
}

function AccountantDashboard({ data, stats, fees }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard icon={Receipt} label="Invoices" value={stats.invoices ?? 0} tone="indigo" />
        <StatCard icon={Clock} label="Unpaid" value={stats.unpaid ?? 0} hint="invoices pending" tone="amber" />
        <StatCard icon={Wallet} label="Overdue" value={stats.overdue ?? 0} hint="past due date" tone="rose" />
        <StatCard icon={Banknote} label="Collected" value={compactMoney(fees.collected)} hint={`of ${compactMoney(fees.billed)} billed`} tone="emerald" />
      </div>

      <div className="grid-main-side">
        <Card title="Collection trend" subtitle="Monthly payments">
          {data.collection_trend?.length ? (
            <AreaChart data={trendPoints(data.collection_trend)} color="#10b981" formatValue={(value) => compactMoney(value)} />
          ) : (
            <EmptyState icon={Banknote} title="No payments yet" />
          )}
        </Card>
        <Card title="Outstanding" subtitle="Follow up on unpaid fees">
          <div style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}>{money(fees.outstanding)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>overdue amount {money(fees.overdue_amount)}</div>
          <div className="progress amber" style={{ marginTop: 16 }}>
            <span style={{ width: `${fees.billed ? Math.round((fees.collected / fees.billed) * 100) : 0}%` }} />
          </div>
          <div style={{ display: "grid", gap: 9, marginTop: 18 }}>
            <Link to="/invoices?status=unpaid" className="btn btn-secondary btn-sm" style={{ justifyContent: "space-between" }}>
              Unpaid invoices <ArrowUpRight size={14} />
            </Link>
            <Link to="/invoices?status=partial" className="btn btn-secondary btn-sm" style={{ justifyContent: "space-between" }}>
              Partially paid <ArrowUpRight size={14} />
            </Link>
            <Link to="/payments" className="btn btn-secondary btn-sm" style={{ justifyContent: "space-between" }}>
              Payment history <ArrowUpRight size={14} />
            </Link>
          </div>
        </Card>
      </div>

      <Card title="Recent payments" subtitle="Latest receipts" style={{ marginTop: 20 }} flush>
        {data.recent_payments?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Receipt</th><th>Student</th><th>Method</th><th className="num">Amount</th><th>Date</th></tr></thead>
              <tbody>
                {data.recent_payments.map((payment) => (
                  <tr key={payment.uuid}>
                    <td className="cell-main">{payment.receipt_number}</td>
                    <td>{payment.student}</td>
                    <td><StatusBadge status={payment.method} /></td>
                    <td className="num">{money(payment.amount)}</td>
                    <td className="cell-sub">{formatDateTime(payment.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Banknote} title="No payments recorded" />
        )}
      </Card>
    </>
  );
}

function FamilyDashboard({ data, stats, fees, attendance }) {
  const navigate = useNavigate();
  const isParent = data.role === "Parent";
  return (
    <>
      <div className="stat-grid" style={{ gridTemplateColumns: `repeat(${isParent ? 3 : 2}, minmax(0, 1fr))` }}>
        {isParent ? <StatCard icon={GraduationCap} label="Children" value={stats.children ?? 0} tone="indigo" /> : null}
        <StatCard icon={CalendarCheck} label="Attendance rate" value={percent(stats.attendance_rate)} hint={`${attendance.present ?? 0} of ${attendance.total ?? 0} days`} tone="emerald" />
        <StatCard icon={Wallet} label="Outstanding fees" value={money(stats.outstanding_fees)} hint={fees.overdue_count ? `${fees.overdue_count} overdue` : "All up to date"} tone={stats.outstanding_fees ? "rose" : "emerald"} />
      </div>

      {data.children?.length ? (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          {data.children.map((child) => (
            <Card key={child.uuid} title={child.name} subtitle={`${child.student_id} · ${child.section || "No section"}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <Avatar name={child.name} size="lg" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Attendance</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="progress green" style={{ flex: 1 }}>
                      <span style={{ width: `${child.attendance_rate}%` }} />
                    </div>
                    <strong style={{ fontSize: 13 }}>{percent(child.attendance_rate, 0)}</strong>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/results?student=${child.uuid}`)}>
                  Report card
                </button>
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/invoices?student=${child.uuid}`)}>
                  Fees
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid-main-side">
        <Card title="Attendance history" subtitle="Last 30 days">
          {attendance.daily?.length ? (
            <AreaChart data={attendancePoints(attendance.daily)} color="#10b981" formatValue={(value) => `${Math.round(value)}%`} />
          ) : (
            <EmptyState icon={CalendarCheck} title="No attendance recorded yet" />
          )}
        </Card>

        <Card title="Latest results" subtitle="Published assessments" actions={<Link to="/results" className="btn btn-ghost btn-sm">All</Link>} flush>
          {data.latest_results?.length ? (
            <div>
              {data.latest_results.map((result, index) => (
                <div key={`${result.subject}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{result.subject}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{result.exam}</div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{result.marks}/{result.max_marks}</div>
                  <Badge tone={result.grade?.startsWith("A") ? "green" : result.grade?.startsWith("F") ? "red" : "blue"}>{result.grade || "—"}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="No results yet" description="Published results will appear here." />
          )}
        </Card>
      </div>
    </>
  );
}
