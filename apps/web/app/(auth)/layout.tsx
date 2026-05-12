import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Đăng nhập — EduManager",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center shadow-card">
          <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <span className="text-ink font-bold text-xl tracking-tight">EduManager</span>
          <p className="text-xs text-ash leading-none mt-0.5">Hệ thống quản lý học tập</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-canvas rounded-md border border-border shadow-card p-8">
        {children}
      </div>

      <p className="mt-6 text-xs text-stone text-center">
        © 2026 EduManager · Hệ thống quản lý trung tâm giáo dục
      </p>
    </div>
  );
}
