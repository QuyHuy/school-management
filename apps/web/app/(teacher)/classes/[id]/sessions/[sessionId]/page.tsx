"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionApi, listAttendanceApi, notifyMeetApi, updateSessionApi } from "@/src/features/attendance/api/attendance.api";
import { getClassApi, listEnrollmentsApi } from "@/src/features/classes/api/classes.api";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import { AttendanceSheet } from "@/src/features/attendance/ui/AttendanceSheet";
import { ExamSection } from "@/src/features/grades/ui/ExamSection";
import type { ClassSession, AttendanceRecord } from "@/src/features/attendance/model/types";
import type { Class, Enrollment } from "@/src/features/classes/model/types";
import type { Student } from "@/src/features/students/model/types";

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0 = Sunday
  const idx = dow === 0 ? 6 : dow - 1;
  return DAY_LABELS[idx];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  }
  return (
    <button
      onClick={handleCopy}
      className="rounded-sm border border-border bg-canvas px-3 py-1.5 text-xs font-semibold text-ash hover:text-ink hover:border-ink transition-colors"
    >
      {copyError ? "Lỗi copy" : copied ? "Đã copy!" : "Copy"}
    </button>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const classId = params.id as string;
  const sessionId = params.sessionId as string;

  const [cls, setCls] = useState<Class | null>(null);
  const [session, setSession] = useState<ClassSession | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);
  const [notifyResultIsError, setNotifyResultIsError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [clsData, sessionData, enrollmentsData, studentsData, attendanceData] =
          await Promise.all([
            getClassApi(classId),
            getSessionApi(classId, sessionId),
            listEnrollmentsApi(classId),
            listStudentsApi(),
            listAttendanceApi(classId, sessionId),
          ]);
        setCls(clsData);
        setSession(sessionData);
        setEnrollments(enrollmentsData);
        setStudents(studentsData);
        setAttendanceRecords(attendanceData);
        setNotes(sessionData.notes ?? "");
      } catch {
        setError("Không thể tải thông tin buổi học. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classId, sessionId]);

  const enrolledStudentIds = new Set(enrollments.map((e) => e.student_id));
  const enrolledStudents = students.filter((s) => enrolledStudentIds.has(s.id));

  const isAttended = attendanceRecords.length > 0;

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesError(null);
    setNotesSaved(false);
    try {
      const updated = await updateSessionApi(classId, sessionId, { notes: notes.trim() || null });
      setSession(updated);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      setNotesError("Không thể lưu ghi chú. Vui lòng thử lại.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleNotifyMeet() {
    if (!session || notifying) return;
    setNotifying(true);
    setNotifyResult(null);
    setNotifyResultIsError(false);
    try {
      const result = await notifyMeetApi(classId, sessionId);
      setNotifyResult(
        result.sent
          ? "Đã gửi vào class channel ✓"
          : "Tính năng đang phát triển — sẽ hoạt động sau khi setup class channel"
      );
    } catch {
      setNotifyResult("Không thể gửi thông báo. Vui lòng thử lại.");
      setNotifyResultIsError(true);
    } finally {
      setNotifying(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="h-5 w-48 bg-stone/20 rounded animate-pulse" />
        <div className="h-8 w-72 bg-stone/20 rounded animate-pulse" />
        <div className="h-4 w-40 bg-stone/20 rounded animate-pulse" />
        <div className="h-48 w-full bg-stone/20 rounded animate-pulse" />
        <div className="h-32 w-full bg-stone/20 rounded animate-pulse" />
        <div className="h-24 w-full bg-stone/20 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !session || !cls) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-4">
        <p className="text-sm text-error">{error ?? "Không tìm thấy buổi học."}</p>
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-ash hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" />Quay lại lịch dạy
        </Link>
      </div>
    );
  }

  const dayLabel = getDayLabel(session.date);
  const dateFormatted = formatDate(session.date);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-ash">
        <Link href="/dashboard" className="hover:text-ink transition-colors">
          Lịch dạy
        </Link>
        <span>/</span>
        <Link href={`/classes/${classId}`} className="hover:text-ink transition-colors">
          {cls.name}
        </Link>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink">
            Buổi học — {dayLabel}, {dateFormatted}
          </h1>
          {isAttended ? (
            <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success border border-success/20">
              Đã điểm danh
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ash border border-border">
              Chưa điểm danh
            </span>
          )}
        </div>
        <p className="text-sm text-ash">
          {cls.name} · {cls.subject}
        </p>
        {/* Mode badge */}
        <div className="flex items-center gap-2 mt-2">
          {session.mode === "online" ? (
            <span className="text-xs font-semibold text-primary bg-primary/8 border border-primary/20 rounded-full px-2.5 py-0.5">
              Học Online
            </span>
          ) : (
            <span className="text-xs font-semibold text-ash bg-surface border border-border rounded-full px-2.5 py-0.5">
              Offline
            </span>
          )}
          {session.start_time && (
            <span className="text-sm text-ash">
              {session.start_time.slice(0, 5)}
            </span>
          )}
        </div>

        {/* Meet link card — only when online */}
        {session.mode === "online" && session.meet_link && (
          <div className="mt-4 rounded-sm border border-border bg-surface px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-ash shrink-0">🔗</span>
              <span className="text-sm font-medium text-ink truncate">{session.meet_link}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyLinkButton link={session.meet_link} />
              <button
                onClick={handleNotifyMeet}
                disabled={notifying}
                className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
              >
                {notifying ? "Đang gửi..." : "Gửi vào class channel"}
              </button>
            </div>
          </div>
        )}
        {notifyResult && (
          <p className={`text-xs mt-2 ${notifyResultIsError ? "text-error" : "text-ash"}`}>{notifyResult}</p>
        )}
      </div>

      {/* Section 1: Điểm danh */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">
          Điểm danh
        </h2>
        <AttendanceSheet
          classId={classId}
          sessionId={sessionId}
          enrollments={enrollments}
          students={enrolledStudents}
          initialRecords={attendanceRecords}
          onSaved={(saved) => setAttendanceRecords(saved)}
        />
      </section>

      {/* Section 2: Ghi chú buổi học */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">
          Ghi chú buổi học
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Nhập ghi chú cho buổi học này..."
          className="w-full rounded-sm border border-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-primary focus:outline-none transition-colors resize-none"
        />
        {notesError && (
          <p className="text-sm text-error">{notesError}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {savingNotes ? "Đang lưu..." : "Lưu ghi chú"}
          </button>
          {notesSaved && (
            <span className="text-sm text-success font-medium">Đã lưu</span>
          )}
        </div>
      </section>

      {/* Section 3: Bài kiểm tra */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">
          Bài kiểm tra
        </h2>
        <ExamSection classId={classId} students={enrolledStudents} filterDate={session.date} />
      </section>
    </div>
  );
}
