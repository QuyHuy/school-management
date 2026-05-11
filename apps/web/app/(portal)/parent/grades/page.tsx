"use client";

import { useEffect, useState } from "react";
import { getChildGradesApi } from "@/src/features/parent/api/parent.api";
import { useParentStore } from "@/src/features/parent/model/store";
import { ChildPicker } from "@/src/features/parent/ui/ChildPicker";
import type { ChildGradeRow } from "@/src/features/parent/model/types";

const EXAM_TYPE_LABELS: Record<string, string> = {
  quiz: "Kiểm tra nhanh",
  midterm: "Giữa kỳ",
  final: "Cuối kỳ",
  assignment: "Bài tập",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

function groupByClass(rows: ChildGradeRow[]) {
  const map: Record<string, { class_name: string; rows: ChildGradeRow[] }> = {};
  for (const r of rows) {
    if (!map[r.class_id]) map[r.class_id] = { class_name: r.class_name, rows: [] };
    map[r.class_id].rows.push(r);
  }
  return Object.values(map);
}

export default function ParentGradesPage() {
  const { children, selectedId } = useParentStore();
  const [grades, setGrades] = useState<ChildGradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = children.find((c) => c.student_id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getChildGradesApi(selectedId)
      .then(setGrades)
      .catch(() => setError("Không thể tải điểm số."))
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (children.length === 0) {
    return (
      <div className="p-5 flex flex-col gap-4">
        <div className="h-6 w-32 bg-stone/30 rounded animate-pulse" />
        <div className="h-48 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Điểm số</h1>
        {selectedChild && (
          <p className="text-sm text-ash mt-0.5">{selectedChild.student_name}</p>
        )}
      </div>

      <ChildPicker />

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-10 bg-stone/20 rounded animate-pulse" />
          <div className="h-40 bg-stone/20 rounded-md animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : groupByClass(grades).length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-6 text-center">
          <p className="text-sm text-ash">Chưa có bài kiểm tra nào.</p>
        </div>
      ) : (
        groupByClass(grades).map((group) => (
          <section key={group.class_name} className="rounded-md border border-border bg-canvas overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface">
              <p className="font-semibold text-ink text-sm">{group.class_name}</p>
            </div>
            <div className="divide-y divide-border">
              {group.rows.map((r) => (
                <div key={r.exam_id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{r.exam_title}</p>
                    <p className="text-xs text-ash">
                      {EXAM_TYPE_LABELS[r.exam_type] ?? r.exam_type} · {formatDate(r.exam_date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.score === null ? (
                      <span className="text-xs text-ash">Chưa có</span>
                    ) : (
                      <>
                        <p className="text-base font-bold text-ink">{r.score}</p>
                        <p className="text-xs text-ash">/ {r.max_score}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
