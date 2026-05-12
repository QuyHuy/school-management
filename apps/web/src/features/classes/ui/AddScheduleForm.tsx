"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addScheduleApi } from "../api/classes.api";
import type { ClassSchedule } from "../model/types";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface Props {
  classId: string;
  onAdded: (schedule: ClassSchedule) => void;
}

export function AddScheduleForm({ classId, onAdded }: Props) {
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const schedule = await addScheduleApi(classId, {
        day_of_week: dayOfWeek,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
      });
      onAdded(schedule);
      setDayOfWeek(0);
      setStartTime("08:00");
      setEndTime("10:00");
    } catch {
      setError("Không thể thêm lịch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Thứ</label>
        <select
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(Number(e.target.value))}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        >
          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Bắt đầu</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Kết thúc</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {loading ? (
          "Đang thêm..."
        ) : (
          <span className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Thêm lịch
          </span>
        )}
      </button>
      {error && <p className="text-xs text-error w-full">{error}</p>}
    </form>
  );
}
