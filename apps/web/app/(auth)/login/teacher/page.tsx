import { LoginForm } from "@/src/features/auth/ui/LoginForm";

export default function TeacherLoginPage() {
  return (
    <div className="bg-canvas rounded-md shadow-card p-8">
      <h1 className="text-2xl font-bold text-ink text-display mb-2">
        Đăng nhập Giáo viên
      </h1>
      <p className="text-sm text-ash mb-6">Dành cho giáo viên và quản trị viên trung tâm</p>
      <LoginForm />
    </div>
  );
}
