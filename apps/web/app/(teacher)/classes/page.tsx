"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClassCard } from "@/src/features/classes/ui/ClassCard";
import { listClassesApi } from "@/src/features/classes/api/classes.api";
import type { Class } from "@/src/features/classes/model/types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClassesApi()
      .then(setClasses)
      .catch(() => setError("Không thể tải danh sách lớp."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Lớp học</h1>
          {!loading && !error && (
            <p className="text-ash text-sm mt-0.5">{classes.length} lớp</p>
          )}
        </div>
        <Link
          href="/classes/new"
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors shadow-sm"
        >
          + Tạo lớp
        </Link>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-md bg-stone/30 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {!loading && !error && classes.length === 0 && (
        <div className="rounded-md border border-border bg-canvas p-10 text-center">
          <div className="text-4xl mb-3">📚</div>
          <p className="font-semibold text-ink">Chưa có lớp nào</p>
          <p className="text-ash text-sm mt-1 mb-4">Tạo lớp học đầu tiên để bắt đầu</p>
          <Link
            href="/classes/new"
            className="inline-block rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
          >
            + Tạo lớp đầu tiên
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {classes.map((c) => (
          <ClassCard key={c.id} class_={c} />
        ))}
      </div>
    </div>
  );
}
