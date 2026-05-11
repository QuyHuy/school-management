"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminDashboard } from "@/src/features/admin/api/admin.api";
import type { AdminDashboard } from "@/src/features/admin/model/types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-canvas rounded-sm border border-border p-5">
      <p className="text-xs text-ash font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(() => setError("Không thể tải dữ liệu dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;
  if (error) return <p className="text-error text-sm">{error}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng giáo viên" value={data.total_teachers} />
        <StatCard label="Lớp đang hoạt động" value={data.total_active_classes} />
        <StatCard label="Tổng học sinh" value={data.total_students} />
        <StatCard label="Chuyên cần tháng này" value={`${data.attendance_rate_this_month}%`} />
      </div>

      <div className="bg-canvas rounded-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-ink">Giáo viên</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-ash text-xs font-medium uppercase">
              <th className="text-left px-5 py-3">Tên</th>
              <th className="text-right px-5 py-3">Số lớp</th>
              <th className="text-right px-5 py-3">Số HS</th>
              <th className="text-right px-5 py-3">Buổi tháng này</th>
            </tr>
          </thead>
          <tbody>
            {data.teachers.map((t) => (
              <tr
                key={t.id}
                onClick={() => router.push(`/admin/teachers/${t.id}` as never)}
                className="border-b border-border last:border-0 hover:bg-surface cursor-pointer transition-colors"
              >
                <td className="px-5 py-3 font-medium text-ink">{t.name}</td>
                <td className="px-5 py-3 text-right text-ash">{t.class_count}</td>
                <td className="px-5 py-3 text-right text-ash">{t.student_count}</td>
                <td className="px-5 py-3 text-right text-ash">{t.sessions_this_month}</td>
              </tr>
            ))}
            {data.teachers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ash text-sm">
                  Chưa có giáo viên nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
