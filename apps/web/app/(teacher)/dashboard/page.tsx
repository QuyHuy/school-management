import Link from "next/link";

const CARDS = [
  {
    href: "/classes",
    icon: "📚",
    title: "Lớp học",
    desc: "Quản lý lớp, lịch học và danh sách học sinh",
  },
];

export default function TeacherDashboard() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink tracking-tight">Xin chào 👋</h1>
        <p className="text-ash text-sm mt-1">Chào mừng trở lại EduManager.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-md border border-border bg-canvas p-6 hover:border-ink hover:shadow-card transition-all"
          >
            <div className="text-3xl mb-3">{c.icon}</div>
            <h2 className="font-semibold text-ink">{c.title}</h2>
            <p className="text-sm text-ash mt-1 leading-relaxed">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
