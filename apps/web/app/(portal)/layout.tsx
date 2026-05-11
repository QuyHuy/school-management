"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/src/features/auth/model/store";
import { useParentStore } from "@/src/features/parent/model/store";
import { listChildrenApi } from "@/src/features/parent/api/parent.api";

const NAV = [
  { href: "/parent/home", label: "Trang chủ", icon: "⊞" },
  { href: "/parent/grades", label: "Điểm số", icon: "📝" },
  { href: "/parent/attendance", label: "Điểm danh", icon: "✓" },
  { href: "/parent/notifications", label: "Thông báo", icon: "🔔" },
  { href: "/parent/profile", label: "Tài khoản", icon: "👤" },
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
        <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface max-w-lg mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 h-14 border-b border-border bg-canvas flex items-center justify-between px-4 shrink-0">
        <span className="text-primary font-bold text-base tracking-tight">EduManager</span>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            PH
          </div>
          <button
            onClick={async () => {
              reset();
              await logout();
              router.push("/login/parent");
            }}
            className="text-xs text-ash hover:text-error transition-colors px-2 py-1 rounded-sm hover:bg-surface"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-canvas max-w-lg mx-auto flex items-center justify-around px-4">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href as never}
              className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors ${
                active ? "text-primary" : "text-ash"
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
