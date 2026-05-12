"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../model/store";

interface Props {
  redirectTo?: string;
}

export function ParentLoginForm({ redirectTo = "/parent/home" }: Props) {
  const loginByPhone = useAuthStore((s) => s.loginByPhone);
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginByPhone(phone.trim(), password);
      router.push(redirectTo as never);
    } catch {
      setError("Số điện thoại hoặc mật khẩu không đúng.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-semibold text-ink">
          Số điện thoại
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-sm border border-border px-4 py-3 text-sm text-ink placeholder-ash focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
          placeholder="0901 234 567"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-border px-4 py-3 text-sm text-ink placeholder-ash focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-canvas transition active:scale-95 disabled:opacity-50 hover:bg-primary-hover"
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
