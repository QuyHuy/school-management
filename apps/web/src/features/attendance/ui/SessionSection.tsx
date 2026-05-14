"use client";

import { useEffect, useState } from "react";
import {
  createSessionApi,
  bulkCreateSessionsApi,
  listAttendanceApi,
  listSessionsApi,
} from "../api/attendance.api";
import type { AttendanceRecord, ClassSession } from "../model/types";
import { AttendanceSheet } from "./AttendanceSheet";
import type { Enrollment } from "@/src/features/classes/model/types";
import type { Student } from "@/src/features/students/model/types";
import { sendZaloAttendanceNotifications } from "@/src/features/zalo/api/zalo.api";

interface Props {
  classId: string;
  enrollments: Enrollment[];
  students: Student[];
}

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} (${DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]})`;
}

export function SessionSection({ classId, enrollments, students }: Props) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newMode, setNewMode] = useState<"online" | "offline">("offline");
  const [newStartTime, setNewStartTime] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sendingZalo, setSendingZalo] = useState(false);
  const [zaloResult, setZaloResult] = useState<string | null>(null);

  const [createMode, setCreateMode] = useState<"single" | "bulk">("single");
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkFromDate, setBulkFromDate] = useState("");
  const [bulkToDate, setBulkToDate] = useState("");
  const [bulkMode, setBulkMode] = useState<"online" | "offline">("offline");
  const [bulkStartTime, setBulkStartTime] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [bulkCreating, setBulkCreating] = useState(false);

  useEffect(() => {
    listSessionsApi(classId)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [classId]);

  async function handleSelectSession(session: ClassSession) {
    if (selectedSession?.id === session.id) {
      setSelectedSession(null);
      return;
    }
    setSelectedSession(session);
    setAttendanceLoading(true);
    try {
      const records = await listAttendanceApi(classId, session.id);
      setAttendanceRecords(records);
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!newDate) return;
    if (newMode === "online" && !newStartTime) {
      setCreateError("Vui lòng nhập giờ bắt đầu cho buổi học online.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const session = await createSessionApi(classId, newDate, {
        mode: newMode,
        start_time: newMode === "online" ? newStartTime : null,
      });
      setSessions((prev) => [session, ...prev]);
      setNewDate("");
      setNewMode("offline");
      setNewStartTime("");
      setSelectedSession(session);
      setAttendanceRecords([]);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setCreateError(
        status === 409 ? "Buổi học ngày này đã tồn tại." : "Không thể tạo buổi học."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleBulkCreate() {
    if (bulkDays.length === 0) { setCreateError("Vui lòng chọn ít nhất một thứ."); return; }
    if (!bulkFromDate || !bulkToDate) { setCreateError("Vui lòng chọn khoảng ngày."); return; }
    if (bulkMode === "online" && !bulkStartTime) { setCreateError("Vui lòng nhập giờ bắt đầu cho buổi học online."); return; }
    setBulkCreating(true);
    setCreateError(null);
    setBulkResult(null);
    try {
      const result = await bulkCreateSessionsApi(classId, {
        days: bulkDays,
        from_date: bulkFromDate,
        to_date: bulkToDate,
        mode: bulkMode,
        start_time: bulkMode === "online" ? bulkStartTime : null,
      });
      setBulkResult(`Đã tạo ${result.created} buổi học${result.skipped > 0 ? `, bỏ qua ${result.skipped} ngày đã có` : ""}.`);
      const updated = await listSessionsApi(classId);
      setSessions(updated);
      setBulkDays([]);
      setBulkFromDate("");
      setBulkToDate("");
      setBulkMode("offline");
      setBulkStartTime("");
    } catch {
      setCreateError("Không thể tạo hàng loạt. Vui lòng thử lại.");
    } finally {
      setBulkCreating(false);
    }
  }

  async function handleSendZalo() {
    if (!selectedSession || sendingZalo) return;
    setSendingZalo(true);
    setZaloResult(null);
    try {
      const result = await sendZaloAttendanceNotifications(classId, selectedSession.id);
      setZaloResult(`Đã gửi ${result.sent_count} thông báo Zalo (bỏ qua ${result.skipped_count}).`);
    } catch {
      setZaloResult("Lỗi khi gửi thông báo Zalo.");
    } finally {
      setSendingZalo(false);
    }
  }

  if (loading) {
    return <div className="h-10 w-full bg-stone/20 rounded animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create session — tab switcher */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => { setCreateMode("single"); setCreateError(null); setBulkResult(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
              createMode === "single" ? "bg-ink text-canvas border-ink" : "bg-canvas text-ash border-border hover:border-ink"
            }`}
          >
            Tạo 1 buổi
          </button>
          <button
            type="button"
            onClick={() => { setCreateMode("bulk"); setCreateError(null); setBulkResult(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
              createMode === "bulk" ? "bg-ink text-canvas border-ink" : "bg-canvas text-ash border-border hover:border-ink"
            }`}
          >
            Tạo hàng loạt
          </button>
        </div>

        {createMode === "single" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ash uppercase tracking-wide">
                Ngày buổi học
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="border border-border rounded-sm px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary"
              />
            </div>
            {/* Mode toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ash uppercase tracking-wide">
                Hình thức
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => { setNewMode("offline"); setNewStartTime(""); setCreateError(null); }}
                  className={`px-3 py-2 text-sm font-semibold rounded-sm border transition-colors ${
                    newMode === "offline"
                      ? "bg-ink text-canvas border-ink"
                      : "bg-canvas text-ash border-border hover:border-ink"
                  }`}
                >
                  Offline
                </button>
                <button
                  type="button"
                  onClick={() => { setNewMode("online"); setCreateError(null); }}
                  className={`px-3 py-2 text-sm font-semibold rounded-sm border transition-colors ${
                    newMode === "online"
                      ? "bg-primary text-canvas border-primary"
                      : "bg-canvas text-ash border-border hover:border-ink"
                  }`}
                >
                  Online
                </button>
              </div>
            </div>
            {/* Start time — only when online */}
            {newMode === "online" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ash uppercase tracking-wide">
                  Giờ bắt đầu *
                </label>
                <input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="border border-border rounded-sm px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary"
                />
              </div>
            )}
            <button
              onClick={handleCreateSession}
              disabled={!newDate || creating}
              className="px-4 py-2 text-sm font-semibold text-canvas bg-primary rounded-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {creating ? "Đang tạo..." : "+ Tạo buổi"}
            </button>
          </div>
        )}

        {createMode === "bulk" && (
          <div className="flex flex-col gap-3">
            {/* Day checkboxes */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ash uppercase tracking-wide">Thứ trong tuần</label>
              <div className="flex flex-wrap gap-1">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setBulkDays((prev) =>
                        prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                      )
                    }
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
                      bulkDays.includes(idx)
                        ? "bg-primary text-canvas border-primary"
                        : "bg-canvas text-ash border-border hover:border-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ash uppercase tracking-wide">Từ ngày</label>
                <input
                  type="date"
                  value={bulkFromDate}
                  onChange={(e) => setBulkFromDate(e.target.value)}
                  className="border border-border rounded-sm px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ash uppercase tracking-wide">Đến ngày</label>
                <input
                  type="date"
                  value={bulkToDate}
                  onChange={(e) => setBulkToDate(e.target.value)}
                  className="border border-border rounded-sm px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ash uppercase tracking-wide">Hình thức</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => { setBulkMode("offline"); setBulkStartTime(""); setCreateError(null); }}
                  className={`px-3 py-2 text-sm font-semibold rounded-sm border transition-colors ${bulkMode === "offline" ? "bg-ink text-canvas border-ink" : "bg-canvas text-ash border-border hover:border-ink"}`}>
                  Offline
                </button>
                <button type="button" onClick={() => { setBulkMode("online"); setCreateError(null); }}
                  className={`px-3 py-2 text-sm font-semibold rounded-sm border transition-colors ${bulkMode === "online" ? "bg-primary text-canvas border-primary" : "bg-canvas text-ash border-border hover:border-ink"}`}>
                  Online
                </button>
              </div>
            </div>

            {bulkMode === "online" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ash uppercase tracking-wide">Giờ bắt đầu *</label>
                <input
                  type="time"
                  value={bulkStartTime}
                  onChange={(e) => setBulkStartTime(e.target.value)}
                  className="border border-border rounded-sm px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary"
                />
              </div>
            )}

            <button
              onClick={handleBulkCreate}
              disabled={bulkCreating || bulkDays.length === 0 || !bulkFromDate || !bulkToDate}
              className="self-start px-4 py-2 text-sm font-semibold text-canvas bg-primary rounded-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {bulkCreating ? "Đang tạo..." : "Tạo hàng loạt"}
            </button>
            {bulkResult && <p className="text-sm text-success">{bulkResult}</p>}
          </div>
        )}
      </div>

      {createError && (
        <p className="text-sm text-error">{createError}</p>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <p className="text-sm text-ash">Chưa có buổi học nào. Tạo buổi học đầu tiên ở trên.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-sm border border-border overflow-hidden">
              <button
                onClick={() => handleSelectSession(s)}
                className="w-full flex items-center justify-between px-4 py-3 bg-canvas hover:bg-surface transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{formatDate(s.date)}</span>
                  {s.mode === "online" && (
                    <span className="text-xs font-semibold text-primary bg-primary/8 border border-primary/20 rounded-full px-2 py-0.5">
                      Online
                    </span>
                  )}
                </span>
                <span className="text-stone text-sm">
                  {selectedSession?.id === s.id ? "▲" : "▼"}
                </span>
              </button>
              {selectedSession?.id === s.id && (
                <div className="px-4 py-4 border-t border-border bg-surface">
                  {attendanceLoading ? (
                    <div className="h-8 bg-stone/20 rounded animate-pulse" />
                  ) : (
                    <AttendanceSheet
                      classId={classId}
                      sessionId={s.id}
                      enrollments={enrollments}
                      students={students}
                      initialRecords={attendanceRecords}
                      onSaved={(records) => setAttendanceRecords(records)}
                    />
                  )}
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={handleSendZalo}
                      disabled={sendingZalo}
                      className="w-full rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas hover:opacity-80 disabled:opacity-50 transition-colors"
                    >
                      {sendingZalo ? "Đang gửi..." : "Gửi Zalo cho phụ huynh"}
                    </button>
                    {zaloResult && (
                      <p className="text-xs text-center text-ash">{zaloResult}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
