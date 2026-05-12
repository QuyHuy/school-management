"use client";

import { useEffect, useState } from "react";
import { getProfileApi, updateProfileApi, type ProfileResponse } from "@/src/features/auth/api/auth.api";

export default function ParentProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    getProfileApi()
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setPhone(p.phone ?? "");
        setEmail(p.email ?? "");
      })
      .catch(() => setError("Không thể tải thông tin tài khoản."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateProfileApi({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      setProfile(updated);
      setName(updated.name);
      setPhone(updated.phone ?? "");
      setEmail(updated.email ?? "");
      setSuccess(true);
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string } } }).response;
      const detail = res?.data?.detail;
      setError(typeof detail === "string" ? detail : "Không thể cập nhật thông tin. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-stone focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition-all";
  const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

  if (loading) {
    return (
      <div className="max-w-md flex flex-col gap-4">
        <div className="h-6 w-48 bg-stone/30 rounded animate-pulse" />
        <div className="h-40 bg-stone/20 rounded-md animate-pulse" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="max-w-md rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-md flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Thông tin cá nhân</h1>
        <p className="text-ash text-sm mt-0.5">Cập nhật tên, số điện thoại và email của bạn</p>
      </div>

      <section className="rounded-md border border-border bg-canvas p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Họ và tên</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Họ và tên"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Số điện thoại</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901 234 567"
              className={inputCls}
            />
            <p className="text-xs text-ash">Số điện thoại dùng để đăng nhập.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Email (tùy chọn)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className={inputCls}
            />
          </div>

          {error && (
            <div className="rounded-sm border border-error/20 bg-error/5 px-3 py-2.5 text-sm text-error">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-sm border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
              Cập nhật thành công.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      </section>
    </div>
  );
}
