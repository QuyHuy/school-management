import Link from "next/link";

export default function TeacherDashboard() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Dashboard Giáo viên</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/classes"
          className="rounded-md border border-border bg-canvas p-6 hover:border-ink transition-colors"
        >
          <h2 className="font-semibold text-ink">Lớp học</h2>
          <p className="text-sm text-ash mt-1">Quản lý lớp và học sinh</p>
        </Link>
      </div>
    </div>
  );
}
