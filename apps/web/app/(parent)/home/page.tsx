"use client";

import { useEffect, useState } from "react";
import { listChildrenApi } from "@/src/features/parent/api/parent.api";
import type { ChildInfo } from "@/src/features/parent/model/types";

function formatDob(dob: string | null) {
  if (!dob) return "—";
  const d = new Date(dob + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function ParentHomePage() {
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listChildrenApi()
      .then(setChildren)
      .catch(() => setError("Không thể tải thông tin."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 flex flex-col gap-4">
        <div className="h-6 w-40 bg-stone/30 rounded animate-pulse" />
        <div className="h-32 bg-stone/20 rounded-md animate-pulse" />
        <div className="h-40 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <h1 className="text-xl font-bold text-ink">Thông tin học sinh</h1>

      {children.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-6 text-center">
          <p className="text-sm text-ash">Chưa có học sinh liên kết với tài khoản này.</p>
        </div>
      ) : (
        children.map((child) => (
          <div key={child.student_id} className="flex flex-col gap-3">
            <div className="rounded-md border border-border bg-canvas p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-base">
                    {child.student_name.trim().split(" ").pop()?.slice(0, 2).toUpperCase() ?? "HS"}
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-ink">{child.student_name}</h2>
                  <p className="text-xs text-ash">Ngày sinh: {formatDob(child.date_of_birth)}</p>
                </div>
              </div>

              <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-2">
                Lớp đang học ({child.classes.length})
              </p>
              {child.classes.length === 0 ? (
                <p className="text-sm text-ash">Chưa đăng ký lớp nào.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {child.classes.map((c) => (
                    <div
                      key={c.class_id}
                      className="flex items-center justify-between rounded-sm bg-surface px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{c.name}</p>
                        <p className="text-xs text-ash">{c.subject} · {c.academic_year}</p>
                      </div>
                      {c.is_active ? (
                        <span className="text-xs font-semibold text-success">Đang học</span>
                      ) : (
                        <span className="text-xs text-ash">Kết thúc</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
