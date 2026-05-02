"use client";

import { deleteScheduleApi } from "../api/classes.api";
import type { ClassSchedule } from "../model/types";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface Props {
  classId: string;
  schedules: ClassSchedule[];
  onDeleted: (id: string) => void;
}

export function ScheduleList({ classId, schedules, onDeleted }: Props) {
  async function handleDelete(scheduleId: string) {
    await deleteScheduleApi(classId, scheduleId);
    onDeleted(scheduleId);
  }

  if (schedules.length === 0) {
    return <p className="text-ash text-sm">Chưa có lịch học.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {schedules.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between rounded border border-border px-4 py-2 text-sm"
        >
          <span className="text-ink">
            {DAYS[s.day_of_week]} · {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
          </span>
          <button
            onClick={() => handleDelete(s.id)}
            className="text-xs text-error hover:underline"
          >
            Xoá
          </button>
        </li>
      ))}
    </ul>
  );
}
