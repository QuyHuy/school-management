import { ParentLoginForm } from "@/src/features/auth/ui/ParentLoginForm";
import { Heart } from "lucide-react";

export default function ParentLoginPage() {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Heart className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Phụ huynh</span>
      </div>
      <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">
        Theo dõi con em
      </h1>
      <p className="text-sm text-ash mb-6">Đăng nhập để xem điểm số và điểm danh</p>
      <ParentLoginForm />
    </>
  );
}
