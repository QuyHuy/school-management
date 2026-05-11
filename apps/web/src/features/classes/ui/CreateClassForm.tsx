"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  const inputCls = "rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-ink">Tên lớp</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Toán 10A"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Môn học</label>
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

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Khối</label>
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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-ink">Năm học</label>
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
          className="rounded-sm border border-border px-4 py-3 text-sm font-semibold text-ink hover:bg-surface transition-colors"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Đang tạo..." : "Tạo lớp"}
        </button>
      </div>
    </form>
  );
}
