"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/features/auth/model/store";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate, logout } = useAuthStore();
  const router = useRouter();

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

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar — wired in Phase 3 */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-canvas" />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar — wired in Phase 3 */}
        <header className="h-16 border-b border-border bg-canvas flex items-center justify-end px-6">
          <button
            onClick={async () => { await logout(); router.push("/login"); }}
            className="text-sm text-ash hover:text-ink transition-colors"
          >
            Đăng xuất
          </button>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
