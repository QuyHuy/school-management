"use client";

import { useState } from "react";
import { createStudentApi } from "../api/students.api";
import type { Student } from "../model/types";

interface Props {
  onCreated: (student: Student) => void;
  onCancel: () => void;
}

export function CreateStudentForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const student = await createStudentApi({
        name,
        date_of_birth: dateOfBirth || null,
        note: note || null,
      });
      onCreated(student);
    } catch {
      setError("Không thể tạo học sinh.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 rounded-md border border-border bg-surface">
      <h3 className="font-semibold text-ink text-sm">Tạo học sinh mới</h3>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Họ tên</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nguyễn Văn A"
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Ngày sinh (tuỳ chọn)</label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-ash">Ghi chú (tuỳ chọn)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="..."
          className="rounded-sm border border-border px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-sm border border-border px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas transition-colors"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Đang tạo..." : "Tạo"}
        </button>
      </div>
    </form>
  );
}
