import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateClassForm } from "@/src/features/classes/ui/CreateClassForm";

export default function NewClassPage() {
  return (
    <div className="max-w-lg">
      <Link
        href="/classes"
        className="flex items-center gap-1.5 text-sm text-ash hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Danh sách lớp
      </Link>
      <h1 className="text-2xl font-bold text-ink tracking-tight mb-6">Tạo lớp mới</h1>
      <div className="rounded-sm border border-border bg-canvas p-6">
        <CreateClassForm />
      </div>
    </div>
  );
}
