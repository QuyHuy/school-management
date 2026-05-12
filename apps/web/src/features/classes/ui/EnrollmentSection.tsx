"use client";

import { useEffect, useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import {
  enrollStudentApi,
  listEnrollmentsApi,
  unenrollStudentApi,
} from "../api/classes.api";
import { listStudentsApi } from "@/src/features/students/api/students.api";
import type { Enrollment } from "../model/types";
import type { Student } from "@/src/features/students/model/types";

interface Props {
  classId: string;
  classGrade: number | null;
}

export function EnrollmentSection({ classId, classGrade }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listEnrollmentsApi(classId), listStudentsApi()])
      .then(([enrs, students]) => {
        setEnrollments(enrs);
        setAllStudents(students);
        const enrolledIds = new Set(enrs.map((e) => e.student_id));
        const eligible = students.filter(
          (s) => !enrolledIds.has(s.id) && (classGrade === null || s.grade === classGrade)
        );
        if (eligible[0]) setSelectedStudentId(eligible[0].id);
      })
      .catch(() => setFetchError("Không thể tải danh sách học sinh."))
      .finally(() => setLoading(false));
  }, [classId, classGrade]);

  const enrolledIds = new Set(enrollments.map((e) => e.student_id));
  const availableStudents = allStudents.filter(
    (s) => !enrolledIds.has(s.id) && (classGrade === null || s.grade === classGrade)
  );

  async function handleEnroll() {
    if (!selectedStudentId) return;
    setEnrolling(true);
    setActionError(null);
    try {
      const enr = await enrollStudentApi(classId, selectedStudentId);
      setEnrollments((prev) => [...prev, enr]);
      const remaining = availableStudents.filter((s) => s.id !== selectedStudentId);
      setSelectedStudentId(remaining[0]?.id ?? "");
    } catch {
      setActionError("Không thể thêm học sinh.");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleUnenroll(studentId: string) {
    if (!window.confirm("Xoá học sinh khỏi lớp này?")) return;
    setActionError(null);
    try {
      await unenrollStudentApi(classId, studentId);
      setEnrollments((prev) => prev.filter((e) => e.student_id !== studentId));
    } catch {
      setActionError("Không thể xoá học sinh. Vui lòng thử lại.");
    }
  }

  const studentMap = Object.fromEntries(allStudents.map((s) => [s.id, s]));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-ink">
          Học sinh ({enrollments.length})
        </h2>
        {classGrade !== null && (
          <span className="text-xs text-ash bg-surface border border-border rounded-full px-2.5 py-0.5">
            Khối {classGrade}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-ash">Đang tải...</p>}
      {fetchError && <p className="text-sm text-error">{fetchError}</p>}

      {!loading && !fetchError && (
        <>
          {enrollments.length === 0 ? (
            <p className="text-sm text-ash mb-4">Chưa có học sinh nào trong lớp.</p>
          ) : (
            <ul className="flex flex-col gap-2 mb-4">
              {enrollments.map((e) => {
                const s = studentMap[e.student_id];
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded border border-border px-4 py-2 text-sm"
                  >
                    <div>
                      <span className="text-ink font-medium">{s?.name ?? e.student_id}</span>
                      {s?.student_code && (
                        <span className="ml-2 text-xs text-ash font-mono">{s.student_code}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnenroll(e.student_id)}
                      className="flex items-center gap-1.5 text-xs text-error hover:text-error/80 transition-colors"
                      title="Xoá khỏi lớp"
                    >
                      <UserMinus className="w-4 h-4" />
                      Xoá khỏi lớp
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {availableStudents.length > 0 ? (
            <div className="flex gap-3 items-center">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex-1 rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none bg-canvas"
              >
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.student_code ? ` (${s.student_code})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {enrolling ? (
                  "..."
                ) : (
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    Thêm
                  </span>
                )}
              </button>
            </div>
          ) : (
            <p className="text-sm text-ash">
              {classGrade !== null
                ? `Không có học sinh khối ${classGrade} nào chưa vào lớp.`
                : "Tất cả học sinh đã vào lớp."}
            </p>
          )}
          {actionError && <p className="text-xs text-error mt-2">{actionError}</p>}
        </>
      )}
    </div>
  );
}
