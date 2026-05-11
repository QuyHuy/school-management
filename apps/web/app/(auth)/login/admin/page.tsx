import { LoginForm } from "@/src/features/auth/ui/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="bg-canvas rounded-md shadow-card p-8">
      <h1 className="text-2xl font-bold text-ink text-display mb-2">
        Đăng nhập Quản trị
      </h1>
      <p className="text-sm text-ash mb-6">Dành cho quản lý trung tâm</p>
      <LoginForm expectedRole="admin" redirectTo="/admin/dashboard" />
    </div>
  );
}
