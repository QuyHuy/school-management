import Link from "next/link";
import { CreateClassForm } from "@/src/features/classes/ui/CreateClassForm";

export default function NewClassPage() {
  return (
    <div className="max-w-lg">
      <Link href="/classes" className="text-sm text-ash hover:text-ink transition-colors">
        ← Danh sách lớp
      </Link>
      <h1 className="text-2xl font-bold text-ink tracking-tight mt-3 mb-6">Tạo lớp mới</h1>
      <div className="rounded-md border border-border bg-canvas p-6">
        <CreateClassForm />
      </div>
    </div>
  );
}
