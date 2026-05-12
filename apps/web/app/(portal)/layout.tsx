"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  FileText,
  CheckSquare,
  Bell,
  User,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { useAuthStore } from "@/src/features/auth/model/store";
import { useParentStore } from "@/src/features/parent/model/store";
import { listChildrenApi } from "@/src/features/parent/api/parent.api";

const NAV = [
  { href: "/parent/home", label: "Trang chủ", icon: Home },
  { href: "/parent/grades", label: "Điểm số", icon: FileText },
  { href: "/parent/attendance", label: "Điểm danh", icon: CheckSquare },
  { href: "/parent/notifications", label: "Thông báo", icon: Bell },
  { href: "/parent/profile", label: "Tài khoản", icon: User },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate, logout, user } = useAuthStore();
  const { setChildren, reset } = useParentStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate().then(() => {
      const state = useAuthStore.getState();
      if (!state.isAuthenticated) {
        router.replace("/login/parent");
      } else if (state.user?.role !== "parent") {
        router.replace("/dashboard");
      }
    });
  }, [hydrate, router]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "parent") return;
    listChildrenApi().then(setChildren).catch(() => {});
    return () => reset();
  }, [isAuthenticated, user?.role, setChildren, reset]);

  if (!isAuthenticated || user?.role !== "parent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  const initials = (user?.user_id ?? "PH").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col min-h-screen bg-surface max-w-lg mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 h-14 border-b border-border bg-canvas flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center">
            <GraduationCap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-ink font-bold text-sm tracking-tight">EduManager</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            {initials}
          </div>
          <button
            onClick={async () => {
              reset();
              await logout();
              router.push("/login/parent");
            }}
            className="flex items-center gap-1 text-xs text-ash hover:text-error transition-colors px-2 py-1 rounded-sm hover:bg-surface"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-canvas max-w-lg mx-auto flex items-center justify-around px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href as never}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-sm transition-colors min-w-0 ${
                active ? "text-primary" : "text-ash hover:text-ink"
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${active ? "text-primary" : "text-stone"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="text-[10px] font-semibold truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
