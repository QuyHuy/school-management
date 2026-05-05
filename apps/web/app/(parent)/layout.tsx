"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/src/features/auth/model/store";

const NAV = [
  { href: "/parent/home", label: "Trang chủ", icon: "⊞" },
  { href: "/parent/grades", label: "Điểm số", icon: "📝" },
  { href: "/parent/attendance", label: "Điểm danh", icon: "✓" },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate, user } = useAuthStore();
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

  if (!isAuthenticated || user?.role !== "parent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-ash text-sm">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface max-w-lg mx-auto">
      <main className="flex-1 overflow-auto pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-canvas max-w-lg mx-auto flex items-center justify-around px-4">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
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
