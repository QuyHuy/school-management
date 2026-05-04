"use client";

import { useState } from "react";
import { createStudentApi } from "../api/students.api";
import type { Student } from "../model/types";

interface Props {
  onCreated: (student: Student) => void;
  onCancel: () => void;
}

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function CreateStudentForm({ onCreated, onCancel }: Props) {
  // Student fields
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [note, setNote] = useState("");

  // Parent fields
  const [hasParent, setHasParent] = useState(true);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentPassword, setParentPassword] = useState(generatePassword);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const student = await createStudentApi({
        name: name.trim(),
        date_of_birth: dateOfBirth || null,
        note: note.trim() || null,
        parent: hasParent
          ? {
              name: parentName.trim(),
              email: parentEmail.trim(),
              phone: parentPhone.trim() || null,
              password: parentPassword,
            }
          : null,
      });
      onCreated(student);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } }).response;
      if (status?.status === 409) {
        setError("Email phụ huynh đã được sử dụng. Vui lòng dùng email khác.");
      } else if (status?.status === 422) {
        setError("Thông tin không hợp lệ. Kiểm tra lại mật khẩu (ít nhất 6 ký tự).");
      } else {
        setError("Không thể tạo học sinh. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-stone focus:border-primary focus:outline-none transition-colors";
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
            onClick={() => setHasParent((v) => !v)}
            className={`text-xs font-semibold px-3 py-1 rounded-sm border transition-colors ${
              hasParent
                ? "bg-primary/8 text-primary border-primary/20"
                : "bg-surface text-ash border-border hover:border-ink"
            }`}
          >
            {hasParent ? "Có tài khoản" : "Bỏ qua"}
          </button>
        </div>

        {hasParent ? (
          <>
            <p className="text-xs text-ash -mt-2">
              Phụ huynh dùng email và mật khẩu này để đăng nhập theo dõi con.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Họ tên phụ huynh *</label>
              <input
                required={hasParent}
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Nguyễn Văn Bình"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Email đăng nhập *</label>
                <input
                  type="email"
                  required={hasParent}
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="phu.huynh@email.com"
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Số điện thoại</label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="0901 234 567"
                  className={inputCls}
                />
              </div>
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
                  required={hasParent}
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
              <p className="text-xs text-ash">
                Chia sẻ mật khẩu này cho phụ huynh. Ít nhất 6 ký tự.
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs text-ash -mt-2">
            Có thể thêm tài khoản phụ huynh sau.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-sm border border-error/20 bg-error/5 px-3 py-2.5 text-sm text-error">
          {error}
        </div>
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
          disabled={loading}
          className="flex-1 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "Đang tạo..." : "Tạo học sinh"}
        </button>
      </div>
    </form>
  );
}
