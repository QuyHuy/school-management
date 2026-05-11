"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTeacher, updateTeacher, resetTeacherPassword, toggleTeacher } from "@/src/features/admin/api/admin.api";
import type { TeacherDetail } from "@/src/features/admin/model/types";

const inputCls = "rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!id) return;
    getTeacher(id).then((t) => {
      setTeacher(t);
      setName(t.name);
      setEmail(t.email ?? "");
      setPhone(t.phone ?? "");
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!teacher) return;
    setSaving(true);
    try {
      const updated = await updateTeacher(id, { name, email, phone: phone || null });
      setTeacher(updated);
      setEditing(false);
      showToast("Đã lưu thông tin.");
    } catch {
      showToast("Lỗi khi lưu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPwd() {
    if (!newPwd) return;
    setResetting(true);
    try {
      await resetTeacherPassword(id, newPwd);
      setShowReset(false);
      setNewPwd("");
      showToast("Đã đặt lại mật khẩu.");
    } catch {
      showToast("Lỗi khi đặt lại mật khẩu.");
    } finally {
      setResetting(false);
    }
  }

  async function handleToggle() {
    if (!teacher) return;
    const updated = await toggleTeacher(id);
    setTeacher(updated);
    showToast(updated.is_active ? "Đã kích hoạt lại." : "Đã vô hiệu hóa.");
  }

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;
  if (!teacher) return <p className="text-error text-sm">Không tìm thấy giáo viên.</p>;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {toast && (
        <div className="fixed top-4 right-4 bg-ink text-white text-sm px-4 py-2 rounded shadow-lg z-50">{toast}</div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-ash hover:text-ink text-sm">← Quay lại</button>
        <h1 className="text-2xl font-bold text-ink">{teacher.name}</h1>
        <span className={`ml-2 text-xs px-2 py-0.5 rounded font-semibold ${teacher.is_active ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
          {teacher.is_active ? "Hoạt động" : "Vô hiệu"}
        </span>
      </div>

      <div className="bg-canvas border border-border rounded-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Thông tin</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-primary font-semibold hover:underline">Chỉnh sửa</button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Họ tên</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Số điện thoại</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface">Huỷ</button>
              <button onClick={handleSave} disabled={saving} className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-ash">Email</dt><dd className="text-ink">{teacher.email ?? "—"}</dd>
            <dt className="text-ash">Số điện thoại</dt><dd className="text-ink">{teacher.phone ?? "—"}</dd>
            <dt className="text-ash">Tổng học sinh</dt><dd className="text-ink">{teacher.total_students}</dd>
          </dl>
        )}

        <div className="flex gap-3 pt-2 border-t border-border">
          <button
            onClick={() => setShowReset(true)}
            className="rounded-sm border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            Đặt lại mật khẩu
          </button>
          <button
            onClick={handleToggle}
            className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
              teacher.is_active
                ? "border border-error text-error hover:bg-error/5"
                : "border border-success text-success hover:bg-success/5"
            }`}
          >
            {teacher.is_active ? "Vô hiệu hóa" : "Kích hoạt lại"}
          </button>
        </div>
      </div>

      {showReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-canvas rounded-sm p-6 w-80 flex flex-col gap-4 shadow-xl">
            <h3 className="text-base font-semibold text-ink">Đặt lại mật khẩu</h3>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Mật khẩu mới"
              className={inputCls}
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowReset(false); setNewPwd(""); }} className="flex-1 rounded-sm border border-border px-4 py-2 text-sm text-ink hover:bg-surface">Huỷ</button>
              <button onClick={handleResetPwd} disabled={resetting || !newPwd} className="flex-1 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                {resetting ? "Đang lưu..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-canvas border border-border rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-ink">Lớp học ({teacher.classes.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-ash text-xs font-medium uppercase">
              <th className="text-left px-5 py-3">Tên lớp</th>
              <th className="text-left px-5 py-3">Môn</th>
              <th className="text-left px-5 py-3">Năm học</th>
              <th className="text-right px-5 py-3">Số HS</th>
              <th className="text-center px-5 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {teacher.classes.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-ink">{c.name}</td>
                <td className="px-5 py-3 text-ash">{c.subject}</td>
                <td className="px-5 py-3 text-ash">{c.academic_year}</td>
                <td className="px-5 py-3 text-right text-ash">{c.student_count}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${c.is_active ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                    {c.is_active ? "Đang dạy" : "Đã kết thúc"}
                  </span>
                </td>
              </tr>
            ))}
            {teacher.classes.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-ash text-sm">Chưa có lớp nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
