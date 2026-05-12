"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart2,
  Settings,
  LogOut,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/src/features/auth/model/store";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/teachers", label: "Giáo viên", icon: Users },
  { href: "/admin/reports/attendance", label: "Báo cáo điểm danh", icon: ClipboardList },
  { href: "/admin/reports/grades", label: "Báo cáo điểm số", icon: BarChart2 },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings },
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-canvas shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-ink font-bold text-base tracking-tight">EduManager</span>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-ash" />
              <span className="text-[11px] text-ash font-medium">Admin</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
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

        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-surface">
            <div className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Quản trị viên</p>
              <p className="text-xs text-ash truncate">{user?.user_id ?? ""}</p>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/login/admin"); }}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 text-xs text-ash hover:text-error transition-colors rounded-sm hover:bg-error/5"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
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
