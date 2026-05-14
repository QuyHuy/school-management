"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { checkParentPhoneApi, linkParentApi } from "../api/students.api";
import type { CheckParentResponse, Student } from "../model/types";

interface Props {
  studentId: string;
  onLinked: (student: Student) => void;
}

type Step = "idle" | "form" | "enter_phone" | "checking" | "link_existing" | "not_parent" | "create_new";

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function LinkParentSection({ studentId, onLinked }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [parentPhone, setParentPhone] = useState("");
  const [existingParent, setExistingParent] = useState<CheckParentResponse | null>(null);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState(generatePassword);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("idle");
    setParentPhone("");
    setExistingParent(null);
    setParentName("");
    setParentEmail("");
    setParentPassword(generatePassword());
    setError(null);
    setShowPassword(false);
  }

  function resetPhone() {
    setStep("enter_phone");
    setParentPhone("");
    setExistingParent(null);
    setError(null);
  }

  async function handleCheckPhone() {
    const phone = parentPhone.trim();
    if (!phone) return;
    setStep("checking");
    setError(null);
    try {
      const result = await checkParentPhoneApi(phone);
      setExistingParent(result);
      if (!result.exists) {
        setStep("create_new");
      } else if (result.is_parent) {
        setStep("link_existing");
      } else {
        setStep("not_parent");
      }
    } catch {
      setStep("enter_phone");
      setError("Không thể kiểm tra số điện thoại. Vui lòng thử lại.");
    }
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const body =
        step === "link_existing"
          ? { phone: parentPhone.trim() }
          : {
              phone: parentPhone.trim(),
              name: parentName.trim(),
              email: parentEmail.trim() || null,
              password: parentPassword,
            };
      const updated = await linkParentApi(studentId, body);
      onLinked(updated);
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: { detail?: string } } }).response;
      if (res?.status === 409) {
        setError(res.data?.detail ?? "Xung đột dữ liệu. Kiểm tra lại số điện thoại.");
      } else if (res?.status === 422) {
        const detail = res.data?.detail;
        setError(typeof detail === "string" ? detail : "Thông tin không hợp lệ. Kiểm tra lại.");
      } else {
        setError("Không thể thêm phụ huynh. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-stone focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition-all";
  const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

  if (step === "idle") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ash">Chưa có tài khoản phụ huynh.</p>
        <button
          onClick={() => setStep("enter_phone")}
          className="inline-flex items-center gap-1.5 self-start rounded-sm border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Thêm phụ huynh
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Enter phone */}
      {(step === "enter_phone" || step === "checking") && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ash">
            Nhập số điện thoại phụ huynh — nếu đã có tài khoản sẽ được liên kết tự động.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCheckPhone(); } }}
              placeholder="0901 234 567"
              disabled={step === "checking"}
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={handleCheckPhone}
              disabled={step === "checking" || !parentPhone.trim()}
              className="shrink-0 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {step === "checking" ? "Đang kiểm tra..." : "Kiểm tra"}
            </button>
          </div>
        </div>
      )}

      {/* Link existing parent */}
      {step === "link_existing" && existingParent && (
        <div className="flex flex-col gap-3">
          <div className="rounded-sm border border-success/30 bg-success/5 px-4 py-3">
            <p className="text-xs font-semibold text-success mb-2">Tìm thấy tài khoản phụ huynh</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-ash">Họ tên</p>
                <p className="text-sm font-medium text-ink">{existingParent.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ash">Số điện thoại</p>
                <p className="text-sm font-medium text-ink">{parentPhone.trim()}</p>
              </div>
              {existingParent.email && (
                <div className="col-span-2">
                  <p className="text-xs text-ash">Email</p>
                  <p className="text-sm font-medium text-ink">{existingParent.email}</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-ash">Học sinh sẽ được liên kết với tài khoản phụ huynh này.</p>
          <button type="button" onClick={resetPhone} className="self-start text-xs text-primary hover:underline">
            ← Đổi số điện thoại
          </button>
        </div>
      )}

      {/* Phone used by non-parent */}
      {step === "not_parent" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-sm border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
            Số điện thoại <span className="font-medium">{parentPhone.trim()}</span> đang được dùng cho tài khoản giáo viên hoặc quản trị viên. Vui lòng dùng số khác.
          </div>
          <button type="button" onClick={resetPhone} className="self-start text-xs text-primary hover:underline">
            ← Đổi số điện thoại
          </button>
        </div>
      )}

      {/* Create new parent account */}
      {step === "create_new" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ash">
              SĐT <span className="font-medium text-ink">{parentPhone.trim()}</span> chưa có tài khoản — điền thông tin để tạo mới.
            </p>
            <button type="button" onClick={resetPhone} className="shrink-0 text-xs text-primary hover:underline ml-3">
              Đổi số
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Họ tên phụ huynh *</label>
            <input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Nguyễn Văn Bình"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Email (tùy chọn)</label>
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="phu.huynh@email.com"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Mật khẩu *</label>
              <button
                type="button"
                onClick={() => setParentPassword(generatePassword())}
                className="text-xs text-primary hover:underline"
              >
                Tạo tự động
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={parentPassword}
                onChange={(e) => setParentPassword(e.target.value)}
                minLength={6}
                className={`${inputCls} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ash hover:text-ink"
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
            <p className="text-xs text-ash">Chia sẻ mật khẩu này cho phụ huynh. Ít nhất 6 ký tự.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-sm border border-error/20 bg-error/5 px-3 py-2.5 text-sm text-error">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={loading}
          className="rounded-sm border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-50 transition-colors"
        >
          Huỷ
        </button>
        {(step === "link_existing" || (step === "create_new" && parentName.trim() && parentPassword.length >= 6)) && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "Đang lưu..." : "Xác nhận"}
          </button>
        )}
      </div>
    </div>
  );
}
