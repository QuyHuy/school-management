"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardApi } from "@/src/features/dashboard/api/dashboard.api";
import type { DashboardSummary } from "@/src/features/dashboard/model/types";

function formatTime(t: string) {
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const todayName = DAY_NAMES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  useEffect(() => {
    getDashboardApi()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Xin chào</h1>
        <p className="text-ash text-sm mt-1">Chào mừng trở lại EduManager.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border bg-canvas p-5">
          <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-1">Lớp đang dạy</p>
          {loading ? (
            <div className="h-8 w-12 bg-stone/30 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-ink">{data?.active_classes_count ?? 0}</p>
          )}
        </div>
        <div className="rounded-md border border-border bg-canvas p-5">
          <p className="text-xs font-semibold text-ash uppercase tracking-wide mb-1">Tổng học sinh</p>
          {loading ? (
            <div className="h-8 w-12 bg-stone/30 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-ink">{data?.total_students_count ?? 0}</p>
          )}
        </div>
      </div>

      <section className="rounded-md border border-border bg-canvas p-5">
        <h2 className="font-semibold text-ink mb-4">Lịch hôm nay — {todayName}</h2>
        {loading ? (
          <div className="space-y-2">
            <div className="h-14 bg-stone/20 rounded animate-pulse" />
            <div className="h-14 bg-stone/20 rounded animate-pulse" />
          </div>
        ) : data?.today_schedule.length === 0 ? (
          <p className="text-sm text-ash py-4 text-center">Không có lớp nào hôm nay.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.today_schedule.map((c) => (
              <Link
                key={c.class_id}
                href={`/classes/${c.class_id}`}
                className="group flex items-center justify-between rounded-sm border border-border bg-surface px-4 py-3 hover:border-ink transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                    {c.class_name}
                  </p>
                  <p className="text-xs text-ash">{c.subject}</p>
                </div>
                <p className="text-sm font-medium text-ash shrink-0">
                  {formatTime(c.start_time)} – {formatTime(c.end_time)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!loading && (data?.pending_sessions.length ?? 0) > 0 && (
        <section className="rounded-md border border-error/20 bg-error/5 p-5">
          <h2 className="font-semibold text-error mb-3 text-sm">
            Chưa điểm danh ({data!.pending_sessions.length} buổi)
          </h2>
          <div className="flex flex-col gap-2">
            {data!.pending_sessions.map((s) => (
              <Link
                key={s.session_id}
                href={`/classes/${s.class_id}`}
                className="flex items-center justify-between rounded-sm border border-error/10 bg-canvas px-4 py-2.5 hover:border-error/30 transition-colors"
              >
                <p className="text-sm font-medium text-ink">{s.class_name}</p>
                <p className="text-xs text-ash">{formatDate(s.date)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/classes"
          className="group rounded-md border border-border bg-canvas p-5 hover:border-ink hover:shadow-card transition-all"
        >
          <p className="text-sm font-semibold text-ink mb-1">Quản lý lớp học</p>
          <p className="text-xs text-ash">Lịch, danh sách, điểm số</p>
        </Link>
        <Link
          href="/students"
          className="group rounded-md border border-border bg-canvas p-5 hover:border-ink hover:shadow-card transition-all"
        >
          <p className="text-sm font-semibold text-ink mb-1">Quản lý học sinh</p>
          <p className="text-xs text-ash">Hồ sơ và danh sách lớp</p>
        </Link>
      </div>
    </div>
  );
}
