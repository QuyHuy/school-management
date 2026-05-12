"use client";

import { useEffect, useState } from "react";
import { listClassesApi } from "@/src/features/classes/api/classes.api";
import type { Class } from "@/src/features/classes/model/types";
import { createSessionApi } from "@/src/features/attendance/api/attendance.api";

interface Props {
  onCreated: (classId: string, sessionId: string) => void;
  onClose: () => void;
}

export function CreateSessionModal({ onCreated, onClose }: Props) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClassesApi().then(setClasses).catch(() => {});
  }, []);

  async function handleCreate() {
    if (!classId || !date) return;
    setCreating(true);
    setError(null);
    try {
      const session = await createSessionApi(classId, date);
      onCreated(classId, session.id);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 409 ? "Buổi học ngày này đã tồn tại." : "Không thể tạo buổi học.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
      <div className="bg-canvas rounded-md border border-border shadow-card w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-ink mb-4">Tạo buổi học</h2>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-ash uppercase tracking-wide">Lớp học</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={creating}
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
            >
              <option value="">Chọn lớp...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-ash uppercase tracking-wide">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={creating}
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-sm border border-border px-3 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleCreate}
            disabled={!classId || !date || creating}
            className="flex-1 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {creating ? "Đang tạo..." : "Tạo buổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
