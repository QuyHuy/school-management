import { LoginForm } from "@/src/features/auth/ui/LoginForm";

export default function ParentLoginPage() {
  return (
    <div className="bg-canvas rounded-md shadow-card p-8">
      <h1 className="text-2xl font-bold text-ink text-display mb-2">
        Đăng nhập Phụ huynh
      </h1>
      <p className="text-sm text-ash mb-6">Dành cho phụ huynh học sinh</p>
      <LoginForm redirectTo="/parent/home" expectedRole="parent" />
    </div>
  );
}
