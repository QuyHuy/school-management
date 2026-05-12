"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
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
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-ink tracking-tight">Lớp học</h1>
          </div>
          <p className="text-sm text-ash">
            {!loading && !error
              ? `${classes.length} lớp đang quản lý`
              : "Quản lý danh sách lớp học"}
          </p>
        </div>
        <Link
          href="/classes/new"
          className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo lớp
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
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo lớp đầu tiên
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
