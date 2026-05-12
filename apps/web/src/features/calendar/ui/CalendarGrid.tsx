"use client";

import type { CalendarSession, CalendarSlot } from "../model/types";
import { SessionEvent, SlotEvent } from "./CalendarEvent";

interface Props {
  year: number;
  month: number; // 1-12
  sessions: CalendarSession[];
  slots: CalendarSlot[];
  loadingSlot: string | null; // "classId|date"
  onSessionClick: (session: CalendarSession) => void;
  onSlotClick: (slot: CalendarSlot) => void;
}

const DAY_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getDaysInGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  // monday-based: firstDay.getDay() 0=Sun → push 6, 1=Mon → push 0, etc.
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month - 1, d));
  }
  const trailingPad = (7 - (days.length % 7)) % 7;
  for (let i = 0; i < trailingPad; i++) days.push(null);
  return days;
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarGrid({
  year,
  month,
  sessions,
  slots,
  loadingSlot,
  onSessionClick,
  onSlotClick,
}: Props) {
  const today = toIso(new Date());
  const days = getDaysInGrid(year, month);

  const sessionsByDate = new Map<string, CalendarSession[]>();
  for (const s of sessions) {
    const arr = sessionsByDate.get(s.date) ?? [];
    arr.push(s);
    sessionsByDate.set(s.date, arr);
  }

  const slotsByDate = new Map<string, CalendarSlot[]>();
  for (const sl of slots) {
    const arr = slotsByDate.get(sl.date) ?? [];
    arr.push(sl);
    slotsByDate.set(sl.date, arr);
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] font-semibold uppercase tracking-wide py-1 ${
              i === 6 ? "text-stone" : "text-mute"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) {
            return <div key={`pad-${idx}`} className="min-h-[88px] rounded-sm bg-surface" />;
          }

          const iso = toIso(day);
          const isToday = iso === today;
          const isSunday = day.getDay() === 0;
          const daySessions = sessionsByDate.get(iso) ?? [];
          const daySlots = slotsByDate.get(iso) ?? [];

          return (
            <div
              key={iso}
              className={`min-h-[88px] rounded-sm p-1.5 border ${
                isToday
                  ? "bg-primary/5 border-primary border-2"
                  : "bg-canvas border-border"
              }`}
            >
              <div className="mb-1">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-canvas text-[11px] font-bold">
                    {day.getDate()}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold ${isSunday ? "text-stone" : "text-ink"}`}>
                    {day.getDate()}
                  </span>
                )}
              </div>

              {daySessions.map((s) => (
                <SessionEvent key={s.id} session={s} onClick={() => onSessionClick(s)} />
              ))}
              {daySlots.map((sl) => (
                <SlotEvent
                  key={`${sl.class_id}-${sl.date}`}
                  slot={sl}
                  loading={loadingSlot === `${sl.class_id}|${sl.date}`}
                  onClick={() => onSlotClick(sl)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
