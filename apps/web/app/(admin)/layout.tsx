"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/src/features/auth/model/store";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/admin/teachers", label: "Giáo viên", icon: "👤" },
  { href: "/admin/reports/attendance", label: "Báo cáo điểm danh", icon: "📋" },
  { href: "/admin/reports/grades", label: "Báo cáo điểm số", icon: "📊" },
  { href: "/admin/settings", label: "Cài đặt", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate, logout, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate().then(() => {
      const state = useAuthStore.getState();
      if (!state.isAuthenticated || state.user?.role !== "admin") {
        router.replace("/login/admin");
      }
    });
  }, [hydrate, router]);

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-canvas shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <span className="text-primary font-bold text-lg tracking-tight">EduManager</span>
          <span className="ml-2 text-xs text-ash font-medium bg-surface px-1.5 py-0.5 rounded">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href as never}
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

        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-ink">Quản trị viên</p>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/login/admin"); }}
            className="mt-1 w-full text-left px-3 py-2 text-xs text-ash hover:text-error transition-colors rounded-sm hover:bg-surface"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
