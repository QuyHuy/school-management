"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCalendarApi } from "@/src/features/calendar/api/calendar.api";
import { createSessionApi } from "@/src/features/attendance/api/attendance.api";
import { CalendarGrid } from "@/src/features/calendar/ui/CalendarGrid";
import { CreateSessionModal } from "@/src/features/calendar/ui/CreateSessionModal";
import type { CalendarData, CalendarSession, CalendarSlot } from "@/src/features/calendar/model/types";

function monthLabel(year: number, month: number) {
  return `Tháng ${month}, ${year}`;
}

function toMonthStr(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarData>({ sessions: [], schedule_slots: [] });
  const [loading, setLoading] = useState(true);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCalendarApi(toMonthStr(year, month))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function goToday() {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth() + 1);
  }

  function handleSessionClick(session: CalendarSession) {
    router.push(`/classes/${session.class_id}/sessions/${session.id}`);
  }

  async function handleSlotClick(slot: CalendarSlot) {
    const key = `${slot.class_id}|${slot.date}`;
    setLoadingSlot(key);
    try {
      const session = await createSessionApi(slot.class_id, slot.date);
      router.push(`/classes/${slot.class_id}/sessions/${session.id}`);
    } catch {
      setLoadingSlot(null);
    }
  }

  function handleModalCreated(classId: string, sessionId: string) {
    setShowModal(false);
    router.push(`/classes/${classId}/sessions/${sessionId}`);
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-sm border border-border bg-canvas px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            ◀
          </button>
          <span className="text-base font-bold text-ink tracking-tight min-w-[140px] text-center">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-sm border border-border bg-canvas px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            ▶
          </button>
          <button
            onClick={goToday}
            className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ash hover:text-ink transition-colors"
          >
            Hôm nay
          </button>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors"
        >
          + Tạo buổi học
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-ash">
          <div className="w-3 h-3 rounded-[2px] bg-surface border-l-2 border-stone" />
          Lịch chưa mở (click để tạo)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ash">
          <div className="w-3 h-3 rounded-[2px] bg-success/8 border-l-2 border-success" />
          Đã điểm danh ✓
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ash">
          <div className="w-3 h-3 rounded-[2px] bg-error/8 border-l-2 border-error" />
          Chưa điểm danh !
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="h-96 bg-stone/10 rounded-md animate-pulse" />
      ) : (
        <CalendarGrid
          year={year}
          month={month}
          sessions={data.sessions}
          slots={data.schedule_slots}
          loadingSlot={loadingSlot}
          onSessionClick={handleSessionClick}
          onSlotClick={handleSlotClick}
        />
      )}

      {showModal && (
        <CreateSessionModal
          onCreated={handleModalCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
