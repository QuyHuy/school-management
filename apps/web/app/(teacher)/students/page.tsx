"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import type { Student } from "@/src/features/students/model/types";

function formatDob(dob: string | null) {
  if (!dob) return "—";
  const d = new Date(dob + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listStudentsApi()
      .then(setStudents)
      .catch(() => setError("Không thể tải danh sách học sinh."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      query.trim()
        ? students.filter((s) =>
            s.name.toLowerCase().includes(query.trim().toLowerCase())
          )
        : students,
    [students, query]
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Học sinh</h1>
          {!loading && !error && (
            <p className="text-ash text-sm mt-0.5">{students.length} học sinh</p>
          )}
        </div>
        <Link
          href="/students/new"
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors shadow-sm"
        >
          + Thêm học sinh
        </Link>
      </div>

      {!loading && !error && students.length > 1 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Tìm theo tên..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-sm border border-border bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-stone focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-stone/30 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {!loading && !error && students.length === 0 && (
        <div className="rounded-md border border-border bg-canvas p-10 text-center">
          <div className="text-4xl mb-3">👤</div>
          <p className="font-semibold text-ink">Chưa có học sinh nào</p>
          <p className="text-ash text-sm mt-1 mb-4">Thêm học sinh đầu tiên để bắt đầu</p>
          <Link
            href="/students/new"
            className="inline-block rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
          >
            + Thêm học sinh
          </Link>
        </div>
      )}

      {!loading && !error && students.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-ash py-6 text-center">Không tìm thấy học sinh nào.</p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((s) => (
          <Link
            key={s.id}
            href={`/students/${s.id}`}
            className="group flex items-center justify-between rounded-md border border-border bg-canvas px-5 py-4 hover:border-ink hover:shadow-card transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-sm">
                  {s.name.trim().split(" ").pop()?.slice(0, 2).toUpperCase() ?? "HS"}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink group-hover:text-primary transition-colors">
                    {s.name}
                  </h3>
                  {s.student_code && (
                    <span className="text-xs font-mono text-ash bg-surface border border-border rounded px-1.5 py-0.5">
                      {s.student_code}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ash mt-0.5">
                  {s.grade ? `Khối ${s.grade}` : ""}
                  {s.grade && s.date_of_birth ? " · " : ""}
                  {s.date_of_birth ? `${formatDob(s.date_of_birth)}` : ""}
                  {!s.grade && !s.date_of_birth ? "Chưa có thông tin" : ""}
                </p>
              </div>
            </div>
            <span className="text-stone text-lg shrink-0">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
