"use client";

import { useState } from "react";
import { markAttendanceApi } from "../api/attendance.api";
import type { AttendanceRecord, AttendanceRecordIn, AttendanceStatus } from "../model/types";
import type { Enrollment } from "@/src/features/classes/model/types";
import type { Student } from "@/src/features/students/model/types";

interface Props {
  classId: string;
  sessionId: string;
  enrollments: Enrollment[];
  students: Student[];
  initialRecords: AttendanceRecord[];
  onSaved: (records: AttendanceRecord[]) => void;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Trễ",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-success/10 text-success border-success/30",
  absent: "bg-error/10 text-error border-error/30",
  late: "bg-amber-50 text-amber-700 border-amber-200",
};

const DEFAULT_STATUS: AttendanceStatus = "present";

export function AttendanceSheet({
  classId,
  sessionId,
  enrollments,
  students,
  initialRecords,
  onSaved,
}: Props) {
  const initialMap = Object.fromEntries(
    initialRecords.map((r) => [r.student_id, r.status as AttendanceStatus])
  );
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(
      enrollments.map((e) => [e.student_id, initialMap[e.student_id] ?? DEFAULT_STATUS])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));

  function toggle(studentId: string, status: AttendanceStatus) {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const records: AttendanceRecordIn[] = enrollments.map((e) => ({
        student_id: e.student_id,
        status: statusMap[e.student_id] ?? DEFAULT_STATUS,
      }));
      const saved = await markAttendanceApi(classId, sessionId, records);
      onSaved(saved);
    } catch {
      setError("Không thể lưu điểm danh. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (enrollments.length === 0) {
    return (
      <p className="text-sm text-ash">Chưa có học sinh nào trong lớp.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-sm border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {enrollments.map((e) => {
          const student = studentById[e.student_id];
          const current = statusMap[e.student_id] ?? DEFAULT_STATUS;
          return (
            <div
              key={e.student_id}
              className="flex items-center justify-between rounded-sm border border-border bg-surface px-4 py-3"
            >
              <span className="text-sm font-medium text-ink">
                {student?.name ?? e.student_id}
              </span>
              <div className="flex gap-1.5">
                {(["present", "absent", "late"] as AttendanceStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggle(e.student_id, s)}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm border transition-colors ${
                      current === s
                        ? STATUS_STYLES[s]
                        : "bg-canvas text-ash border-border hover:border-ink"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {saving ? "Đang lưu..." : "Lưu điểm danh"}
        </button>
      </div>
    </div>
  );
}
