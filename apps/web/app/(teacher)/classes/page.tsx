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
        <h1 className="text-2xl font-bold text-ink">Lớp học của tôi</h1>
        <Link
          href="/classes/new"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
        >
          + Tạo lớp
        </Link>
      </div>
      {loading && <p className="text-ash text-sm">Đang tải...</p>}
      {error && <p className="text-error text-sm">{error}</p>}
      {!loading && !error && classes.length === 0 && (
        <p className="text-ash text-sm">Chưa có lớp nào. Tạo lớp đầu tiên!</p>
      )}
      <div className="flex flex-col gap-3">
        {classes.map((c) => (
          <ClassCard key={c.id} class_={c} />
        ))}
      </div>
    </div>
  );
}
