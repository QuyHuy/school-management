"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClassApi } from "../api/classes.api";
import { SUBJECTS, GRADES } from "@/src/shared/config/subjects";

export function CreateClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<typeof SUBJECTS[number]>(SUBJECTS[0]);
  const [grade, setGrade] = useState<number>(1);
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const class_ = await createClassApi({ name, subject, academic_year: academicYear, grade });
      router.push(`/classes/${class_.id}`);
    } catch {
      setError("Không thể tạo lớp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition-all";
  const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Tên lớp *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Toán 10A"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Môn học</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as typeof SUBJECTS[number])}
            className={inputCls}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Khối</label>
          <select
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className={inputCls}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>Khối {g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Năm học *</label>
        <input
          required
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="VD: 2025-2026"
          className={inputCls}
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-sm border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <BookOpen className="w-4 h-4" />
          {loading ? "Đang tạo..." : "Tạo lớp học"}
        </button>
      </div>
    </form>
  );
}
