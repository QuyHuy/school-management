"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getStudentApi, listStudentClassesApi } from "@/src/features/students/api/students.api";
import type { Student } from "@/src/features/students/model/types";
import type { Class } from "@/src/features/classes/model/types";

function formatDob(dob: string | null) {
  if (!dob) return "—";
  const d = new Date(dob + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStudentApi(id), listStudentClassesApi(id)])
      .then(([s, c]) => { setStudent(s); setClasses(c); })
      .catch(() => setError("Không thể tải thông tin học sinh."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl flex flex-col gap-4">
        <div className="h-6 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-8 w-56 bg-stone/30 rounded animate-pulse" />
        <div className="h-32 bg-stone/20 rounded-md animate-pulse mt-2" />
        <div className="h-40 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-2xl">
        <Link href="/students" className="text-sm text-ash hover:text-ink">← Danh sách học sinh</Link>
        <div className="mt-4 rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error ?? "Không tìm thấy học sinh."}
        </div>
      </div>
    );
  }

  const initials = student.name.trim().split(" ").pop()?.slice(0, 2).toUpperCase() ?? "HS";

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <Link href="/students" className="text-sm text-ash hover:text-ink transition-colors">
          ← Danh sách học sinh
        </Link>
      </div>

      {/* Profile card */}
      <section className="rounded-md border border-border bg-canvas p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-xl">{initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">{student.name}</h1>
            <p className="text-ash text-sm mt-0.5">Thêm vào: {formatDate(student.created_at)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-sm bg-surface px-4 py-3">
            <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-1">Ngày sinh</p>
            <p className="text-sm font-medium text-ink">{formatDob(student.date_of_birth)}</p>
          </div>
          <div className="rounded-sm bg-surface px-4 py-3">
            <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-1">Số lớp</p>
            <p className="text-sm font-medium text-ink">{classes.length} lớp</p>
          </div>
          {student.note && (
            <div className="col-span-2 rounded-sm bg-surface px-4 py-3">
              <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-1">Ghi chú</p>
              <p className="text-sm text-ink">{student.note}</p>
            </div>
          )}
        </div>
      </section>

      {/* Enrolled classes */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Lớp đang học ({classes.length})</h2>

        {classes.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-ash">Chưa đăng ký lớp nào.</p>
            <p className="text-xs text-ash mt-1">
              Vào{" "}
              <Link href="/classes" className="text-primary hover:underline">
                Lớp học
              </Link>{" "}
              để thêm học sinh vào lớp.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/classes/${c.id}`}
                className="group flex items-center justify-between rounded-sm border border-border bg-surface px-4 py-3 hover:border-ink transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-primary/8 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-xs">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                      {c.name}
                    </p>
                    <p className="text-xs text-ash">{c.subject} · {c.academic_year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.is_active ? (
                    <span className="text-xs font-semibold text-success bg-success/10 rounded-full px-2.5 py-0.5">
                      Đang học
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-ash bg-surface rounded-full px-2.5 py-0.5">
                      Kết thúc
                    </span>
                  )}
                  <span className="text-stone text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
