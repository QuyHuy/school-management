"use client";

import { useState } from "react";
import { getGradesReport } from "@/src/features/admin/api/admin.api";
import type { GradeReportRow } from "@/src/features/admin/model/types";

export default function GradesReportPage() {
  const [rows, setRows] = useState<GradeReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getGradesReport({}));
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Báo cáo điểm số</h1>

      <div className="bg-canvas border border-border rounded-sm p-4 flex gap-3 items-end">
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Đang tải..." : "Xem báo cáo"}
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {rows !== null && (
        <div className="bg-canvas border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-ash text-xs font-medium uppercase">
                <th className="text-left px-5 py-3">Giáo viên</th>
                <th className="text-left px-5 py-3">Lớp</th>
                <th className="text-left px-5 py-3">Môn</th>
                <th className="text-right px-5 py-3">Số HS</th>
                <th className="text-right px-5 py-3">TB</th>
                <th className="text-right px-5 py-3">Thấp nhất</th>
                <th className="text-right px-5 py-3">Cao nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-ink">{r.teacher_name}</td>
                  <td className="px-5 py-3 text-ink">{r.class_name}</td>
                  <td className="px-5 py-3 text-ash">{r.subject}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.student_count}</td>
                  <td className="px-5 py-3 text-right font-semibold text-ink">{r.avg_score}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.min_score}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.max_score}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-ash text-sm">Chưa có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
