import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../lib/usePageTitle";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useDebounced, useList, useReferenceData } from "../lib/hooks";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
} from "../components/ui";
import { ExamFormModal } from "./ExamModals";

/**
 * Examination directory. Each exam opens a dedicated workspace where papers,
 * analytics and mark entry live on their own pages.
 */
export default function Exams() {
  usePageTitle("Exams");
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [published, setPublished] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
        subtitle="Create exams, then open one to schedule papers, enter marks and publish results"
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
          <select className="select" aria-label="Filter by publication status" value={published} onChange={(event) => setPublished(event.target.value)}>
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
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/exams/${exam.uuid}`)}>
                          <ClipboardList size={14} /> Open
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

      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete this exam?" message={`${deleting?.name} and all of its papers and results will be removed. This cannot be undone.`} confirmLabel="Delete exam" />
    </>
  );
}
