"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  BookOpen,
  Users,
  MessageSquare,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { useAuthStore } from "@/src/features/auth/model/store";

const NAV = [
  { href: "/dashboard", label: "Lịch dạy", icon: CalendarDays },
  { href: "/classes", label: "Lớp học", icon: BookOpen },
  { href: "/students", label: "Học sinh", icon: Users },
  { href: "/feedback", label: "Phản hồi PH", icon: MessageSquare },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate, logout, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate().then(() => {
      if (!useAuthStore.getState().isAuthenticated) {
        router.replace("/login");
      }
    });
  }, [hydrate, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  const roleLabel = user?.role === "admin" ? "Quản trị viên" : "Giáo viên";
  const userName = user?.user_id ?? roleLabel;
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-canvas shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-ink font-bold text-base tracking-tight">EduManager</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href as never}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-semibold transition-all ${
                  active
                    ? "bg-primary/8 text-primary"
                    : "text-ash hover:bg-surface hover:text-ink"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-stone"}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {label}
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User block */}
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-surface">
            <div className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{roleLabel}</p>
              <p className="text-xs text-ash truncate">{user?.user_id ?? ""}</p>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/login"); }}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 text-xs text-ash hover:text-error transition-colors rounded-sm hover:bg-error/5"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar (mobile only) */}
        <header className="h-14 border-b border-border bg-canvas flex items-center justify-between px-5 md:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-ink font-bold text-sm">EduManager</span>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/login"); }}
            className="flex items-center gap-1.5 text-xs text-ash hover:text-error transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
