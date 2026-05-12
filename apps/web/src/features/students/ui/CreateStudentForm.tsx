"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { createStudentApi, checkParentPhoneApi } from "../api/students.api";
import { GRADES } from "@/src/shared/config/subjects";
import type { Student, CheckParentResponse } from "../model/types";

interface Props {
  onCreated: (student: Student) => void;
  onCancel: () => void;
}

type ParentStep = "enter_phone" | "checking" | "link_existing" | "not_parent" | "create_new";

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function CreateStudentForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number>(1);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [note, setNote] = useState("");

  const [hasParent, setHasParent] = useState(true);
  const [parentStep, setParentStep] = useState<ParentStep>("enter_phone");
  const [parentPhone, setParentPhone] = useState("");
  const [existingParent, setExistingParent] = useState<CheckParentResponse | null>(null);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState(generatePassword);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetParent() {
    setParentStep("enter_phone");
    setParentPhone("");
    setExistingParent(null);
    setParentName("");
    setParentEmail("");
    setParentPassword(generatePassword());
  }

  async function handleCheckPhone() {
    const phone = parentPhone.trim();
    if (!phone) return;
    setParentStep("checking");
    setError(null);
    try {
      const result = await checkParentPhoneApi(phone);
      setExistingParent(result);
      if (!result.exists) {
        setParentStep("create_new");
      } else if (result.is_parent) {
        setParentStep("link_existing");
      } else {
        setParentStep("not_parent");
      }
    } catch {
      setParentStep("enter_phone");
      setError("Không thể kiểm tra số điện thoại. Vui lòng thử lại.");
    }
  }

  function isReadyToSubmit() {
    if (!hasParent) return true;
    if (parentStep === "link_existing") return true;
    if (parentStep === "create_new") {
      return parentName.trim().length > 0 && parentPassword.length >= 6;
    }
    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReadyToSubmit()) return;
    setError(null);
    setLoading(true);
    try {
      const parentPayload = hasParent
        ? parentStep === "link_existing"
          ? { phone: parentPhone.trim() }
          : {
              phone: parentPhone.trim(),
              name: parentName.trim(),
              email: parentEmail.trim() || null,
              password: parentPassword,
            }
        : null;

      const student = await createStudentApi({
        name: name.trim(),
        grade,
        date_of_birth: dateOfBirth || null,
        note: note.trim() || null,
        parent: parentPayload,
      });
      onCreated(student);
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: { detail?: string } } }).response;
      if (res?.status === 409) {
        setError("Số điện thoại này đang được sử dụng cho tài khoản khác.");
      } else if (res?.status === 422) {
        const detail = res.data?.detail;
        setError(typeof detail === "string" ? detail : "Thông tin không hợp lệ. Kiểm tra lại mật khẩu (ít nhất 6 ký tự).");
      } else {
        setError("Không thể tạo học sinh. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-stone focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition-all";
  const labelCls = "text-xs font-semibold text-ash uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* ── Thông tin học sinh ── */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink border-b border-border pb-2">
          Thông tin học sinh
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Họ và tên *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn An"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Khối học *</label>
          <select
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className={inputCls}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>Khối {g}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Ngày sinh</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Ghi chú</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Dị ứng, đặc điểm cần lưu ý..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* ── Tài khoản phụ huynh ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-ink">Tài khoản phụ huynh</h3>
          <button
            type="button"
            onClick={() => { setHasParent((v) => !v); resetParent(); }}
            className={`text-xs font-semibold px-3 py-1 rounded-sm border transition-colors ${
              hasParent
                ? "bg-primary/8 text-primary border-primary/20"
                : "bg-surface text-ash border-border hover:border-ink"
            }`}
          >
            {hasParent ? "Có tài khoản" : "Bỏ qua"}
          </button>
        </div>

        {!hasParent && (
          <p className="text-xs text-ash -mt-2">Có thể thêm tài khoản phụ huynh sau.</p>
        )}

        {hasParent && (
          <>
            {/* Step 1: Enter phone */}
            {(parentStep === "enter_phone" || parentStep === "checking") && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-ash -mt-2">
                  Nhập số điện thoại phụ huynh — nếu đã có tài khoản sẽ được liên kết tự động.
                </p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCheckPhone(); } }}
                    placeholder="0901 234 567"
                    disabled={parentStep === "checking"}
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={handleCheckPhone}
                    disabled={parentStep === "checking" || !parentPhone.trim()}
                    className="shrink-0 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
                  >
                    {parentStep === "checking" ? "Đang kiểm tra..." : "Kiểm tra"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2a: Existing parent → link */}
            {parentStep === "link_existing" && existingParent && (
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
                <p className="text-xs text-ash">
                  Học sinh sẽ được liên kết với tài khoản phụ huynh này.
                </p>
                <button
                  type="button"
                  onClick={resetParent}
                  className="self-start text-xs text-primary hover:underline"
                >
                  ← Đổi số điện thoại
                </button>
              </div>
            )}

            {/* Step 2b: Phone used by non-parent → block */}
            {parentStep === "not_parent" && (
              <div className="flex flex-col gap-3">
                <div className="rounded-sm border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
                  Số điện thoại <span className="font-medium">{parentPhone.trim()}</span> đang được dùng cho tài khoản giáo viên hoặc quản trị viên. Vui lòng dùng số khác.
                </div>
                <button
                  type="button"
                  onClick={resetParent}
                  className="self-start text-xs text-primary hover:underline"
                >
                  ← Đổi số điện thoại
                </button>
              </div>
            )}

            {/* Step 2c: New phone → create form */}
            {parentStep === "create_new" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ash">
                    SĐT <span className="font-medium text-ink">{parentPhone.trim()}</span> chưa có tài khoản — điền thông tin để tạo mới.
                  </p>
                  <button
                    type="button"
                    onClick={resetParent}
                    className="shrink-0 text-xs text-primary hover:underline ml-3"
                  >
                    Đổi số
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Họ tên phụ huynh *</label>
                  <input
                    required
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
                      required
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
          </>
        )}
      </div>

      {error && (
        <div className="rounded-sm border border-error/20 bg-error/5 px-3 py-2.5 text-sm text-error">
          {error}
        </div>
      )}

      {hasParent && (parentStep === "enter_phone" || parentStep === "checking") && (
        <p className="text-xs text-stone -mt-4">
          Kiểm tra số điện thoại phụ huynh trước khi tạo học sinh.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-sm border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface transition-colors"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={loading || !isReadyToSubmit()}
          className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          {loading ? "Đang tạo..." : "Tạo học sinh"}
        </button>
      </div>
    </form>
  );
}
