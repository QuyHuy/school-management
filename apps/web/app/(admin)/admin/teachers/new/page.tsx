"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { createTeacher } from "@/src/features/admin/api/admin.api";

const inputCls =
  "w-full rounded-sm border border-border bg-canvas px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition-all";
const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

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
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-ash hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-ink tracking-tight">Thêm giáo viên</h1>
        </div>
        <p className="text-sm text-ash">Tạo tài khoản giáo viên mới cho trung tâm</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-canvas border border-border rounded-sm p-6">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Họ tên *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Email *</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="teacher@email.com" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Mật khẩu *</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Mật khẩu ban đầu" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Số điện thoại</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="0901234567" />
        </div>

        {error && (
          <div className="rounded-sm border border-error/20 bg-error/5 px-3 py-2.5 text-sm text-error">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-sm border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "Đang tạo..." : "Tạo giáo viên"}
          </button>
        </div>
      </form>
    </div>
  );
}
