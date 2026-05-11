"use client";

import { useState } from "react";
import { getAttendanceReport } from "@/src/features/admin/api/admin.api";
import type { AttendanceReportRow } from "@/src/features/admin/model/types";

const inputCls = "rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

export default function AttendanceReportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<AttendanceReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAttendanceReport({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setRows(data);
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Báo cáo điểm danh</h1>

      <div className="bg-canvas border border-border rounded-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-ash">Từ ngày</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-ash">Đến ngày</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
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
                <th className="text-right px-5 py-3">Buổi</th>
                <th className="text-right px-5 py-3">Có mặt</th>
                <th className="text-right px-5 py-3">Vắng</th>
                <th className="text-right px-5 py-3">Tỉ lệ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-ink">{r.teacher_name}</td>
                  <td className="px-5 py-3 text-ink">{r.class_name}</td>
                  <td className="px-5 py-3 text-ash">{r.subject}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.total_sessions}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.present}</td>
                  <td className="px-5 py-3 text-right text-ash">{r.absent}</td>
                  <td className="px-5 py-3 text-right font-semibold text-ink">{r.attendance_rate}%</td>
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
