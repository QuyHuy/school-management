"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteScheduleApi } from "../api/classes.api";
import type { ClassSchedule } from "../model/types";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface Props {
  classId: string;
  schedules: ClassSchedule[];
  onDeleted: (id: string) => void;
}

export function ScheduleList({ classId, schedules, onDeleted }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(scheduleId: string) {
    if (!window.confirm("Xoá lịch học này?")) return;
    setError(null);
    try {
      await deleteScheduleApi(classId, scheduleId);
      onDeleted(scheduleId);
    } catch {
      setError("Không thể xoá lịch học. Vui lòng thử lại.");
    }
  }

  if (schedules.length === 0) {
    return <p className="text-ash text-sm">Chưa có lịch học.</p>;
  }

  return (
    <div>
      {error && <p className="text-xs text-error mb-2">{error}</p>}
      <ul className="flex flex-col gap-2">
        {schedules.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-full border border-border px-4 py-2 text-sm"
          >
            <span className="text-ink">
              {DAYS[s.day_of_week]} · {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
            </span>
            <button
              onClick={() => handleDelete(s.id)}
              className="flex items-center gap-1.5 text-xs text-error hover:text-error/80 transition-colors"
              title="Xoá lịch học"
            >
              <Trash2 className="w-4 h-4" />
              Xoá
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
