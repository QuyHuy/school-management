"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeacher } from "@/src/features/admin/api/admin.api";

const inputCls = "rounded-sm border border-border px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink bg-canvas";

export default function NewTeacherPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createTeacher({ name, email, password, phone: phone || null });
      router.push("/admin/teachers" as never);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Không thể tạo giáo viên. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-ash hover:text-ink text-sm">← Quay lại</button>
        <h1 className="text-2xl font-bold text-ink">Thêm giáo viên</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-canvas border border-border rounded-sm p-6">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Họ tên *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Email *</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="teacher@email.com" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Mật khẩu *</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Mật khẩu ban đầu" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-ink">Số điện thoại</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="0901234567" />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="rounded-sm border border-border px-4 py-3 text-sm font-semibold text-ink hover:bg-surface transition-colors">
            Huỷ
          </button>
          <button type="submit" disabled={loading} className="flex-1 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50">
            {loading ? "Đang tạo..." : "Tạo giáo viên"}
          </button>
        </div>
      </form>
    </div>
  );
}
