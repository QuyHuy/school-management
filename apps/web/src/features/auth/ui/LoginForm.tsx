"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "../model/store";

interface Props {
  redirectTo?: string;
  expectedRole?: "teacher" | "admin" | "parent";
}

export function LoginForm({ redirectTo = "/dashboard", expectedRole }: Props) {
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const user = useAuthStore.getState().user;
      if (expectedRole && user?.role !== expectedRole) {
        await useAuthStore.getState().logout();
        setError("Tài khoản này không có quyền truy cập trang này.");
        return;
      }
      router.push(redirectTo as never);
    } catch {
      setError("Email hoặc mật khẩu không đúng.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-sm border border-border bg-canvas px-4 py-3 text-sm text-ink placeholder:text-stone focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 transition-all";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-ink">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="giaovien@truong.edu.vn"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          Mật khẩu
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-11`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone hover:text-ash transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-sm bg-error/5 border border-error/20 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-error shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang đăng nhập...
          </>
        ) : (
          "Đăng nhập"
        )}
      </button>
    </form>
  );
}
