"use client";

import { useEffect, useState } from "react";
import { getChildAttendanceApi } from "@/src/features/parent/api/parent.api";
import { useParentStore } from "@/src/features/parent/model/store";
import { ChildPicker } from "@/src/features/parent/ui/ChildPicker";
import type { ChildAttendanceRow } from "@/src/features/parent/model/types";

const STATUS_CONFIG = {
  present: { label: "Có mặt", color: "text-success bg-success/10" },
  absent: { label: "Vắng", color: "text-error bg-error/10" },
  late: { label: "Muộn", color: "text-amber-600 bg-amber-50" },
} as const;

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

export default function ParentAttendancePage() {
  const { children, selectedId } = useParentStore();
  const [records, setRecords] = useState<ChildAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = children.find((c) => c.student_id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getChildAttendanceApi(selectedId)
      .then(setRecords)
      .catch(() => setError("Không thể tải điểm danh."))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;

  if (children.length === 0) {
    return (
      <div className="p-5 flex flex-col gap-4">
        <div className="h-6 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-20 bg-stone/20 rounded-md animate-pulse" />
        <div className="h-48 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Điểm danh</h1>
        {selectedChild && (
          <p className="text-sm text-ash mt-0.5">{selectedChild.student_name}</p>
        )}
      </div>

      <ChildPicker />

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-20 bg-stone/20 rounded-md animate-pulse" />
          <div className="h-48 bg-stone/20 rounded-md animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : (
        <>
          {records.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-border bg-canvas p-3 text-center">
                <p className="text-2xl font-bold text-success">{present}</p>
                <p className="text-xs text-ash mt-0.5">Có mặt</p>
              </div>
              <div className="rounded-md border border-border bg-canvas p-3 text-center">
                <p className="text-2xl font-bold text-error">{absent}</p>
                <p className="text-xs text-ash mt-0.5">Vắng</p>
              </div>
              <div className="rounded-md border border-border bg-canvas p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{late}</p>
                <p className="text-xs text-ash mt-0.5">Muộn</p>
              </div>
            </div>
          )}

          {records.length === 0 ? (
            <div className="rounded-md border border-border bg-canvas p-6 text-center">
              <p className="text-sm text-ash">Chưa có buổi học nào.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-canvas overflow-hidden">
              <div className="divide-y divide-border">
                {records.map((r) => {
                  const cfg = r.status ? STATUS_CONFIG[r.status] : null;
                  return (
                    <div key={r.session_id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink">{r.class_name}</p>
                        <p className="text-xs text-ash">{formatDate(r.date)}</p>
                        {r.note && <p className="text-xs text-ash italic mt-0.5">{r.note}</p>}
                      </div>
                      {cfg ? (
                        <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      ) : (
                        <span className="text-xs text-stone">Chưa điểm danh</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
