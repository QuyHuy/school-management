"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Users, BookOpen, CheckSquare, TrendingUp, ChevronRight } from "lucide-react";
import { getAdminDashboard } from "@/src/features/admin/api/admin.api";
import type { AdminDashboard } from "@/src/features/admin/model/types";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-canvas rounded-sm border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ash font-medium uppercase tracking-wide">{label}</p>
        <div className="text-stone">{icon}</div>
      </div>
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
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-ink tracking-tight">Dashboard</h1>
          </div>
          <p className="text-sm text-ash">Tổng quan hoạt động của trung tâm</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tổng giáo viên"
          value={data.total_teachers}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Lớp đang hoạt động"
          value={data.total_active_classes}
          icon={<BookOpen className="w-4 h-4" />}
        />
        <StatCard
          label="Tổng học sinh"
          value={data.total_students}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Chuyên cần tháng này"
          value={`${data.attendance_rate_this_month}%`}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      <div className="bg-canvas rounded-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-ash" />
          <h2 className="text-base font-semibold text-ink">Giáo viên</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-ash text-xs font-medium uppercase">
              <th className="text-left px-5 py-3">Tên</th>
              <th className="text-right px-5 py-3">Số lớp</th>
              <th className="text-right px-5 py-3">Số HS</th>
              <th className="text-right px-5 py-3">Buổi tháng này</th>
              <th className="px-5 py-3"></th>
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
                <td className="px-5 py-3 text-right text-stone">
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </td>
              </tr>
            ))}
            {data.teachers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ash text-sm">
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
