"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/src/features/auth/model/store";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/classes", label: "Lớp học", icon: "📚" },
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
        <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  const roleLabel = user?.role === "admin" ? "Quản trị viên" : "Giáo viên";
  const initials = roleLabel.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-canvas shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border">
          <span className="text-primary font-bold text-lg tracking-tight">EduManager</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary/8 text-primary"
                    : "text-ash hover:bg-surface hover:text-ink"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User block */}
        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{roleLabel}</p>
              <p className="text-xs text-ash truncate capitalize">{user?.role ?? ""}</p>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/login"); }}
            className="mt-1 w-full text-left px-3 py-2 text-xs text-ash hover:text-error transition-colors rounded-sm hover:bg-surface"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="h-14 border-b border-border bg-canvas flex items-center justify-between px-5 md:hidden">
          <span className="text-primary font-bold">EduManager</span>
          <button
            onClick={async () => { await logout(); router.push("/login"); }}
            className="text-sm text-ash hover:text-ink"
          >
            Đăng xuất
          </button>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
