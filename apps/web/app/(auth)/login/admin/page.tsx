import { LoginForm } from "@/src/features/auth/ui/LoginForm";
import { ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Quản trị viên</span>
      </div>
      <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">
        Quản trị hệ thống
      </h1>
      <p className="text-sm text-ash mb-6">Đăng nhập với tài khoản quản trị viên</p>
      <LoginForm redirectTo="/admin/dashboard" expectedRole="admin" />
    </>
  );
}
