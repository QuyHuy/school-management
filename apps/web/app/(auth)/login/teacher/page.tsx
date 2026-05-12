import { LoginForm } from "@/src/features/auth/ui/LoginForm";
import { GraduationCap } from "lucide-react";

export default function TeacherLoginPage() {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Giáo viên</span>
      </div>
      <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">
        Chào mừng trở lại
      </h1>
      <p className="text-sm text-ash mb-6">Đăng nhập để quản lý lớp học của bạn</p>
      <LoginForm expectedRole="teacher" />
    </>
  );
}
