"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getClassApi, listSchedulesApi, listEnrollmentsApi } from "@/src/features/classes/api/classes.api";
import { ScheduleList } from "@/src/features/classes/ui/ScheduleList";
import { AddScheduleForm } from "@/src/features/classes/ui/AddScheduleForm";
import { EnrollmentSection } from "@/src/features/classes/ui/EnrollmentSection";
import { SessionSection } from "@/src/features/attendance/ui/SessionSection";
import type { Class, ClassSchedule, Enrollment } from "@/src/features/classes/model/types";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import type { Student } from "@/src/features/students/model/types";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [class_, setClass_] = useState<Class | null>(null);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getClassApi(id), listSchedulesApi(id), listEnrollmentsApi(id), listStudentsApi()])
      .then(([c, s, e, st]) => { setClass_(c); setSchedules(s); setEnrollments(e); setStudents(st); })
      .catch(() => setError("Không thể tải thông tin lớp."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl flex flex-col gap-4">
        <div className="h-6 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-8 w-64 bg-stone/30 rounded animate-pulse" />
        <div className="h-40 bg-stone/20 rounded-md animate-pulse mt-2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <Link href="/classes" className="text-sm text-ash hover:text-ink">← Danh sách lớp</Link>
        <div className="mt-4 rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      </div>
    );
  }

  if (!class_) return null;

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link href="/classes" className="text-sm text-ash hover:text-ink transition-colors">
          ← Danh sách lớp
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">{class_.name}</h1>
            <p className="text-ash text-sm mt-1">{class_.subject} · {class_.academic_year}</p>
          </div>
          {class_.is_active ? (
            <span className="text-xs font-semibold text-success bg-success/10 rounded-full px-3 py-1.5 mt-1">
              Đang học
            </span>
          ) : (
            <span className="text-xs font-semibold text-ash bg-surface rounded-full px-3 py-1.5 mt-1">
              Kết thúc
            </span>
          )}
        </div>
      </div>

      {/* Schedules */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Lịch học</h2>
        <ScheduleList
          classId={id}
          schedules={schedules}
          onDeleted={(sid) => setSchedules((prev) => prev.filter((s) => s.id !== sid))}
        />
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-3">Thêm buổi học</p>
          <AddScheduleForm
            classId={id}
            onAdded={(s) => setSchedules((prev) => [...prev, s])}
          />
        </div>
      </section>

      {/* Students */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <EnrollmentSection classId={id} />
      </section>

      {/* Attendance */}
      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Điểm danh</h2>
        <SessionSection classId={id} enrollments={enrollments} students={students} />
      </section>
    </div>
  );
}
