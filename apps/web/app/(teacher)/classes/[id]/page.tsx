"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getClassApi, listSchedulesApi } from "@/src/features/classes/api/classes.api";
import { ScheduleList } from "@/src/features/classes/ui/ScheduleList";
import { AddScheduleForm } from "@/src/features/classes/ui/AddScheduleForm";
import { EnrollmentSection } from "@/src/features/classes/ui/EnrollmentSection";
import type { Class, ClassSchedule } from "@/src/features/classes/model/types";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [class_, setClass_] = useState<Class | null>(null);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getClassApi(id), listSchedulesApi(id)])
      .then(([c, s]) => { setClass_(c); setSchedules(s); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;
  if (!class_) return <p className="text-error text-sm">Không tìm thấy lớp.</p>;

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <div>
        <Link href="/classes" className="text-sm text-ash hover:text-ink">
          ← Danh sách lớp
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">{class_.name}</h1>
        <p className="text-ash text-sm">{class_.subject} · {class_.academic_year}</p>
      </div>
      <section>
        <h2 className="text-lg font-semibold text-ink mb-3">Lịch học</h2>
        <ScheduleList
          classId={id}
          schedules={schedules}
          onDeleted={(sid) => setSchedules((prev) => prev.filter((s) => s.id !== sid))}
        />
        <div className="mt-4">
          <AddScheduleForm
            classId={id}
            onAdded={(s) => setSchedules((prev) => [...prev, s])}
          />
        </div>
      </section>
      <EnrollmentSection classId={id} />
    </div>
  );
}
