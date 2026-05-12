"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getClassApi, listSchedulesApi, listEnrollmentsApi } from "@/src/features/classes/api/classes.api";
import { listSessionsApi } from "@/src/features/attendance/api/attendance.api";
import { listExamsApi, listGradesApi } from "@/src/features/grades/api/grades.api";
import { ScheduleList } from "@/src/features/classes/ui/ScheduleList";
import { AddScheduleForm } from "@/src/features/classes/ui/AddScheduleForm";
import { EnrollmentSection } from "@/src/features/classes/ui/EnrollmentSection";
import { ExamSection } from "@/src/features/grades/ui/ExamSection";
import { computeWeightedAverage } from "@/src/features/grades/lib/grading";
import type { Class, ClassSchedule, Enrollment } from "@/src/features/classes/model/types";
import type { ClassSession } from "@/src/features/attendance/model/types";
import type { Exam, Grade } from "@/src/features/grades/model/types";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import type { Student } from "@/src/features/students/model/types";

type Tab = "students" | "sessions" | "grades" | "schedule";

const TABS: { key: Tab; label: string }[] = [
  { key: "students", label: "Học sinh" },
  { key: "sessions", label: "Buổi học" },
  { key: "grades", label: "Điểm số" },
  { key: "schedule", label: "Lịch học" },
];

const WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function formatSessionDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = WEEKDAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
  return `${weekday}, ${day}/${month}/${year}`;
}

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();

  // Core data
  const [class_, setClass_] = useState<Class | null>(null);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("students");

  // Lazy-loaded: sessions
  const [sessions, setSessions] = useState<ClassSession[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Lazy-loaded: exams + grades
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [gradesByExam, setGradesByExam] = useState<Record<string, Grade[]> | null>(null);
  const [examsLoading, setExamsLoading] = useState(false);

  // Load core data on mount
  useEffect(() => {
    Promise.all([getClassApi(id), listSchedulesApi(id), listEnrollmentsApi(id), listStudentsApi()])
      .then(([c, s, e, st]) => {
        setClass_(c);
        setSchedules(s);
        setEnrollments(e);
        setStudents(st);
      })
      .catch(() => setError("Không thể tải thông tin lớp."))
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy load sessions when tab becomes active
  useEffect(() => {
    if (activeTab === "sessions" && sessions === null && !sessionsLoading) {
      setSessionsLoading(true);
      listSessionsApi(id)
        .then((data) => setSessions(data))
        .catch(() => setSessions([]))
        .finally(() => setSessionsLoading(false));
    }
  }, [activeTab, id, sessions, sessionsLoading]);

  // Lazy load exams + grades when students tab is active
  useEffect(() => {
    if (activeTab === "students" && exams === null && !examsLoading) {
      setExamsLoading(true);
      listExamsApi(id)
        .then(async (fetchedExams) => {
          setExams(fetchedExams);
          const gradeResults = await Promise.all(
            fetchedExams.map((exam) => listGradesApi(id, exam.id))
          );
          const byExam: Record<string, Grade[]> = {};
          fetchedExams.forEach((exam, i) => {
            byExam[exam.id] = gradeResults[i];
          });
          setGradesByExam(byExam);
        })
        .catch(() => {
          setExams([]);
          setGradesByExam({});
        })
        .finally(() => setExamsLoading(false));
    }
  }, [activeTab, id, exams, examsLoading]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const enrolledStudentIds = new Set(enrollments.map((e) => e.student_id));
  const enrolledStudents = students.filter((s) => enrolledStudentIds.has(s.id));

  // ── Loading / Error states ─────────────────────────────────────────────────
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
        <Link href="/classes" className="flex items-center gap-1.5 text-sm text-ash hover:text-ink transition-colors"><ArrowLeft className="w-4 h-4" />Danh sách lớp</Link>
        <div className="mt-4 rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      </div>
    );
  }

  if (!class_) return null;

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <Link href="/classes" className="flex items-center gap-1.5 text-sm text-ash hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" />Danh sách lớp
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">{class_.name}</h1>
            <p className="text-ash text-sm mt-1">
              {class_.subject} · {class_.academic_year}
              {class_.grade !== null && ` · Khối ${class_.grade}`}
            </p>
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

      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "pb-3 text-sm font-semibold transition-colors",
                activeTab === tab.key
                  ? "text-primary border-b-2 border-primary"
                  : "text-ash border-b-2 border-transparent hover:text-ink",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Học sinh ─────────────────────────────────────────── */}
      {activeTab === "students" && (
        <div className="flex flex-col gap-5">
          {/* Students summary table */}
          <div className="rounded-md border border-border bg-canvas overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-ink">
                Học sinh ({enrolledStudents.length})
              </h2>
            </div>
            {enrolledStudents.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ash">Chưa có học sinh nào trong lớp.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-ash text-xs font-semibold uppercase tracking-wide">
                    <th className="px-5 py-3 text-left">Học sinh</th>
                    <th className="px-5 py-3 text-center">Có mặt</th>
                    <th className="px-5 py-3 text-center">Vắng</th>
                    <th className="px-5 py-3 text-right">TB Môn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrolledStudents.map((student) => {
                    const avg =
                      exams && gradesByExam
                        ? computeWeightedAverage(exams, gradesByExam, student.id)
                        : null;

                    return (
                      <tr key={student.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-medium text-ink">{student.name}</span>
                          {student.student_code && (
                            <span className="ml-2 text-xs text-ash font-mono">
                              {student.student_code}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center text-ash">—</td>
                        <td className="px-5 py-3 text-center text-ash">—</td>
                        <td className="px-5 py-3 text-right">
                          {examsLoading ? (
                            <span className="text-ash text-xs">...</span>
                          ) : avg === null ? (
                            <span className="text-ash">—</span>
                          ) : (
                            <span
                              className={avg < 5 ? "text-error font-semibold" : "text-ink font-semibold"}
                            >
                              {avg}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Enrollment management */}
          <div className="rounded-md border border-border bg-canvas p-5">
            <EnrollmentSection classId={id} classGrade={class_.grade} />
          </div>
        </div>
      )}

      {/* ── Tab: Buổi học ─────────────────────────────────────────── */}
      {activeTab === "sessions" && (
        <div className="rounded-md border border-border bg-canvas overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-ink">Buổi học</h2>
          </div>

          {sessionsLoading && (
            <div className="flex flex-col gap-2 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-stone/20 rounded animate-pulse" />
              ))}
            </div>
          )}

          {!sessionsLoading && sessions !== null && sessions.length === 0 && (
            <p className="px-5 py-4 text-sm text-ash">
              Chưa có buổi học nào. Tạo buổi từ trang Lịch dạy.
            </p>
          )}

          {!sessionsLoading && sessions !== null && sessions.length > 0 && (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-5 py-3 text-ink">
                      {formatSessionDate(session.date)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/classes/${id}/sessions/${session.id}`}
                        className="text-primary text-xs font-semibold hover:underline"
                      >
                        Chi tiết →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Điểm số ──────────────────────────────────────────── */}
      {activeTab === "grades" && (
        <div className="rounded-md border border-border bg-canvas p-5">
          <ExamSection classId={id} students={enrolledStudents} />
        </div>
      )}

      {/* ── Tab: Lịch học ─────────────────────────────────────────── */}
      {activeTab === "schedule" && (
        <div className="rounded-md border border-border bg-canvas p-5">
          <h2 className="font-semibold text-ink mb-4">Lịch học</h2>
          <ScheduleList
            classId={id}
            schedules={schedules}
            onDeleted={(sid) => setSchedules((prev) => prev.filter((s) => s.id !== sid))}
          />
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-3">Thêm lịch</p>
            <AddScheduleForm
              classId={id}
              onAdded={(s) => setSchedules((prev) => [...prev, s])}
            />
          </div>
        </div>
      )}
    </div>
  );
}
