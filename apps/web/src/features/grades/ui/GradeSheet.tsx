"use client";

import { useState } from "react";
import { bulkUpsertGradesApi } from "../api/grades.api";
import type { Exam, Grade, GradeIn } from "../model/types";
import type { Student } from "@/src/features/students/model/types";

interface Props {
  classId: string;
  exam: Exam;
  students: Student[];
  initialGrades: Grade[];
  onSaved: (grades: Grade[]) => void;
}

export function GradeSheet({ classId, exam, students, initialGrades, onSaved }: Props) {
  const gradeMap = new Map(initialGrades.map((g) => [g.student_id, g]));
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of students) {
      const g = gradeMap.get(s.id);
      init[s.id] = g ? String(g.score) : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSave() {
    const filled: GradeIn[] = [];
    for (const s of students) {
      const raw = scores[s.id];
      if (raw === "" || raw === undefined) continue;
      const score = parseFloat(raw);
      if (isNaN(score) || score < 0 || score > exam.max_score) {
        setError(`Điểm của ${s.name} không hợp lệ (0 – ${exam.max_score}).`);
        return;
      }
      filled.push({ student_id: s.id, score });
    }
    if (filled.length === 0) {
      setError("Chưa nhập điểm cho học sinh nào.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await bulkUpsertGradesApi(classId, exam.id, filled);
      onSaved(saved);
      setSavedAt(new Date().toLocaleTimeString("vi-VN"));
    } catch {
      setError("Không thể lưu điểm. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const filledCount = students.filter((s) => scores[s.id] !== "").length;
  const avg =
    filledCount > 0
      ? (
          students
            .filter((s) => scores[s.id] !== "")
            .reduce((sum, s) => sum + parseFloat(scores[s.id] || "0"), 0) / filledCount
        ).toFixed(1)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 text-xs text-ash">
        <span>{filledCount}/{students.length} học sinh có điểm</span>
        {avg && <span>TB: <strong className="text-ink">{avg}</strong></span>}
        {savedAt && <span className="text-success">Đã lưu lúc {savedAt}</span>}
      </div>

      <div className="rounded-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ash uppercase tracking-wide">
                Học sinh
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-ash uppercase tracking-wide w-32">
                Điểm / {exam.max_score}
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const val = scores[s.id] ?? "";
              const num = parseFloat(val);
              const invalid = val !== "" && !isNaN(num) && (num > exam.max_score || num < 0);
              return (
                <tr
                  key={s.id}
                  className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-canvas" : "bg-surface/50"}`}
                >
                  <td className="px-4 py-2.5 text-ink font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={exam.max_score}
                      step={0.5}
                      value={val}
                      onChange={(e) =>
                        setScores((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      placeholder="—"
                      className={`w-24 rounded-sm border px-2 py-1 text-sm text-right focus:outline-none transition-colors ${
                        invalid
                          ? "border-error text-error focus:border-error"
                          : "border-border bg-canvas focus:border-primary"
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {saving ? "Đang lưu..." : "Lưu điểm"}
        </button>
      </div>
    </div>
  );
}
