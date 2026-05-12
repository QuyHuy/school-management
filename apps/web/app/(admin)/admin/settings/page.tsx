"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Save } from "lucide-react";
import { getSettings, updateSettings } from "@/src/features/admin/api/admin.api";
import type { OrgSettings } from "@/src/features/admin/model/types";

const inputCls =
  "w-full rounded-sm border border-border bg-canvas px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition-all";
const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

function getAcademicYears(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const start = current - 1 + i;
    return `${start}-${start + 1}`;
  });
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [zaloOaId, setZaloOaId] = useState("");
  const [zaloToken, setZaloToken] = useState("");

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setName(s.name);
      setPhone(s.phone ?? "");
      setAddress(s.address ?? "");
      setAcademicYear(s.academic_year ?? "");
      setLogoUrl(s.logo_url ?? "");
      setZaloOaId(s.zalo_oa_id ?? "");
      setZaloToken("");
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<OrgSettings> = {
        name,
        phone: phone || null,
        address: address || null,
        academic_year: academicYear || null,
        logo_url: logoUrl || null,
        zalo_oa_id: zaloOaId || null,
      };
      if (zaloToken) payload.zalo_oa_token = zaloToken;
      const updated = await updateSettings(payload);
      setSettings(updated);
      setZaloToken("");
      showToast("Đã lưu cài đặt.");
    } catch {
      showToast("Lỗi khi lưu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-ash text-sm">Đang tải...</p>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {toast && (
        <div className="fixed top-4 right-4 bg-ink text-canvas text-sm px-4 py-2 rounded shadow-lg z-50">{toast}</div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-ink tracking-tight">Cài đặt trung tâm</h1>
        </div>
        <p className="text-sm text-ash">Thông tin và cấu hình trung tâm</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4 bg-canvas border border-border rounded-sm p-6">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Tên trung tâm *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Số điện thoại</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="0901234567" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Địa chỉ</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Năm học</label>
          <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputCls}>
            <option value="">— Chọn năm học —</option>
            {getAcademicYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Logo URL</label>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputCls} placeholder="https://example.com/logo.png" />
        </div>

        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <p className="text-xs text-ash font-semibold uppercase tracking-wide">Zalo OA (tuỳ chọn)</p>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Zalo OA ID</label>
            <input value={zaloOaId} onChange={(e) => setZaloOaId(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>
              Zalo OA Token
              {settings?.zalo_oa_token && (
                <span className="ml-2 text-xs text-ash font-normal normal-case">({settings.zalo_oa_token})</span>
              )}
            </label>
            <input
              type="password"
              value={zaloToken}
              onChange={(e) => setZaloToken(e.target.value)}
              className={inputCls}
              placeholder="Nhập token mới để cập nhật"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </form>
    </div>
  );
}
