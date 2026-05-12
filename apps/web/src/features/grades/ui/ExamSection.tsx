"use client";

import { useEffect, useState } from "react";
import {
  createExamApi,
  deleteExamApi,
  listExamsApi,
  listGradesApi,
} from "../api/grades.api";
import type { CreateExamRequest, Exam, ExamType, Grade } from "../model/types";
import { EXAM_TYPE_LABELS } from "../model/types";
import { GradeSheet } from "./GradeSheet";
import type { Student } from "@/src/features/students/model/types";

interface Props {
  classId: string;
  students: Student[];
  filterDate?: string; // "YYYY-MM-DD" — if provided, only show exams with exam_date matching this
}

function formatExamDate(d: string | null) {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

const EXAM_TYPE_OPTIONS: { value: ExamType; label: string }[] = [
  { value: "quiz", label: "Kiểm tra thường xuyên" },
  { value: "midterm", label: "Giữa kỳ" },
  { value: "final", label: "Cuối kỳ" },
  { value: "assignment", label: "Bài tập" },
];

const WEIGHT_LABEL: Record<string, string> = {
  quiz: "×1",
  midterm: "×2",
  final: "×3",
  assignment: "—",
};

const EXAM_WEIGHT: Record<string, number> = { quiz: 1, midterm: 2, final: 3 };

export function ExamSection({ classId, students, filterDate }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gradesCache, setGradesCache] = useState<Record<string, Grade[]>>({});
  const [gradesLoading, setGradesLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ExamType>("quiz");
  const [maxScore, setMaxScore] = useState("10");
  const [examDate, setExamDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    listExamsApi(classId)
      .then(setExams)
      .finally(() => setLoading(false));
  }, [classId]);

  const visibleExams = filterDate
    ? exams.filter((e) => e.exam_date === filterDate)
    : exams;

  async function handleExpand(exam: Exam) {
    if (expandedId === exam.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(exam.id);
    if (!gradesCache[exam.id]) {
      setGradesLoading(true);
      try {
        const grades = await listGradesApi(classId, exam.id);
        setGradesCache((prev) => ({ ...prev, [exam.id]: grades }));
      } finally {
        setGradesLoading(false);
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const ms = parseFloat(maxScore);
    if (isNaN(ms) || ms <= 0) { setCreateError("Điểm tối đa phải lớn hơn 0."); return; }
    setCreating(true);
    try {
      const body: CreateExamRequest = {
        title: title.trim(),
        type,
        max_score: ms,
        weight_percent: EXAM_WEIGHT[type] ?? 0,
        exam_date: examDate || null,
      };
      const exam = await createExamApi(classId, body);
      setExams((prev) => [...prev, exam]);
      setTitle(""); setMaxScore("10"); setExamDate("");
      setShowCreate(false);
    } catch {
      setCreateError("Không thể tạo bài kiểm tra.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(exam: Exam) {
    if (!confirm(`Xoá bài kiểm tra "${exam.title}"? Toàn bộ điểm sẽ bị xoá.`)) return;
    try {
      await deleteExamApi(classId, exam.id);
      setExams((prev) => prev.filter((e) => e.id !== exam.id));
      if (expandedId === exam.id) setExpandedId(null);
    } catch {
      alert("Không thể xoá bài kiểm tra.");
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-primary focus:outline-none transition-colors";
  const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

  if (loading) {
    return <div className="h-10 w-full bg-stone/20 rounded animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {visibleExams.length === 0 && !showCreate ? (
        <p className="text-sm text-ash">
          {filterDate ? "Chưa có bài kiểm tra nào trong buổi học này." : "Chưa có bài kiểm tra nào."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleExams.map((exam) => {
            const grades = gradesCache[exam.id] ?? [];
            const gradedCount = grades.length;
            const avg =
              gradedCount > 0
                ? (grades.reduce((s, g) => s + g.score, 0) / gradedCount).toFixed(1)
                : null;

            return (
              <div key={exam.id} className="rounded-sm border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-canvas">
                  <button
                    onClick={() => handleExpand(exam)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{exam.title}</p>
                        <span className="text-xs font-bold text-ink bg-surface border border-border rounded-full px-2 py-0.5">
                          {WEIGHT_LABEL[exam.type] ?? "—"}
                        </span>
                      </div>
                      <p className="text-xs text-ash mt-0.5">
                        {EXAM_TYPE_LABELS[exam.type]}
                        {exam.exam_date ? ` · ${formatExamDate(exam.exam_date)}` : ""}
                        {" · "}Tối đa {exam.max_score} điểm
                        {exam.weight_percent > 0 ? ` · ${exam.weight_percent}%` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {avg && (
                        <span className="text-xs text-ash">TB: <strong className="text-ink">{avg}</strong></span>
                      )}
                      <span className="text-xs text-ash">{gradedCount}/{students.length} đã có điểm</span>
                      <span className="text-stone text-sm">{expandedId === exam.id ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(exam)}
                    className="ml-3 text-xs text-ash hover:text-error transition-colors"
                  >
                    Xoá
                  </button>
                </div>

                {expandedId === exam.id && (
                  <div className="px-4 py-4 border-t border-border bg-surface">
                    {gradesLoading && !gradesCache[exam.id] ? (
                      <div className="h-8 bg-stone/20 rounded animate-pulse" />
                    ) : students.length === 0 ? (
                      <p className="text-sm text-ash">Chưa có học sinh trong lớp.</p>
                    ) : (
                      <GradeSheet
                        classId={classId}
                        exam={exam}
                        students={students}
                        initialGrades={gradesCache[exam.id] ?? []}
                        onSaved={(saved) =>
                          setGradesCache((prev) => ({ ...prev, [exam.id]: saved }))
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="rounded-sm border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3"
        >
          <h3 className="text-sm font-semibold text-ink">Tạo bài kiểm tra mới</h3>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Tên bài kiểm tra *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kiểm tra 15 phút chương 2"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Loại *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ExamType)}
                className={inputCls}
              >
                {EXAM_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Ngày kiểm tra</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Điểm tối đa *</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="rounded-sm bg-surface border border-border px-3 py-2 text-xs text-ash">
            Hệ số: <strong className="text-ink">{WEIGHT_LABEL[type] ?? "—"}</strong>
            {type === "assignment" && " · Không tính vào điểm TB môn"}
          </div>

          {createError && <p className="text-sm text-error">{createError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError(null); }}
              className="flex-1 rounded-sm border border-border px-3 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="flex-1 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {creating ? "Đang tạo..." : "Tạo"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="self-start text-sm font-semibold text-primary hover:underline"
        >
          + Thêm bài kiểm tra
        </button>
      )}
    </div>
  );
}
