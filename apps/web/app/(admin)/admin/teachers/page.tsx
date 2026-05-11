"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listTeachers, toggleTeacher } from "@/src/features/admin/api/admin.api";
import type { TeacherInfo } from "@/src/features/admin/model/types";

export default function TeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    listTeachers().then(setTeachers).finally(() => setLoading(false));
  }, []);

  async function handleToggle(id: string) {
    setToggling(id);
    try {
      const updated = await toggleTeacher(id);
      setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: updated.is_active } : t)));
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Giáo viên</h1>
        <button
          onClick={() => router.push("/admin/teachers/new" as never)}
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
        >
          + Thêm giáo viên
        </button>
      </div>

      <div className="bg-canvas rounded-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-ash text-xs font-medium uppercase">
              <th className="text-left px-5 py-3">Tên</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-right px-5 py-3">Số lớp</th>
              <th className="text-right px-5 py-3">Số HS</th>
              <th className="text-center px-5 py-3">Trạng thái</th>
              <th className="text-right px-5 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                <td className="px-5 py-3 font-medium text-ink">{t.name}</td>
                <td className="px-5 py-3 text-ash">{t.email ?? "—"}</td>
                <td className="px-5 py-3 text-right text-ash">{t.class_count}</td>
                <td className="px-5 py-3 text-right text-ash">{t.student_count}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                    t.is_active ? "bg-success/10 text-success" : "bg-error/10 text-error"
                  }`}>
                    {t.is_active ? "Hoạt động" : "Vô hiệu"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => router.push(`/admin/teachers/${t.id}` as never)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Xem
                    </button>
                    <button
                      onClick={() => handleToggle(t.id)}
                      disabled={toggling === t.id}
                      className="text-xs text-ash hover:text-error font-semibold disabled:opacity-50"
                    >
                      {t.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ash text-sm">
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
