import Link from "next/link";
import { GraduationCap, ShieldCheck, Heart, ChevronRight } from "lucide-react";

const ROLES = [
  {
    href: "/login/teacher",
    icon: GraduationCap,
    title: "Giáo viên",
    desc: "Quản lý lớp học, điểm danh, và điểm số",
  },
  {
    href: "/login/admin",
    icon: ShieldCheck,
    title: "Quản trị viên",
    desc: "Quản lý toàn bộ hệ thống và giáo viên",
  },
  {
    href: "/login/parent",
    icon: Heart,
    title: "Phụ huynh",
    desc: "Theo dõi tiến độ học tập của con",
  },
];

export default function LoginSelectorPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">Đăng nhập</h1>
      <p className="text-sm text-ash mb-6">Chọn loại tài khoản của bạn</p>
      <div className="flex flex-col gap-2.5">
        {ROLES.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-sm border border-border bg-canvas hover:border-ink hover:shadow-card px-4 py-4 transition-all"
          >
            <div className="w-10 h-10 rounded-sm bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
              <Icon className="w-5 h-5 text-primary" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink text-sm">{title}</p>
              <p className="text-xs text-ash mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-stone group-hover:text-ash transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </>
  );
}
