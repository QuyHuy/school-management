"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreateStudentForm } from "@/src/features/students/ui/CreateStudentForm";
import type { Student } from "@/src/features/students/model/types";

export default function NewStudentPage() {
  const router = useRouter();

  function handleCreated(student: Student) {
    router.push(`/students/${student.id}`);
  }

  return (
    <div className="max-w-lg">
      <Link href="/students" className="text-sm text-ash hover:text-ink transition-colors">
        ← Danh sách học sinh
      </Link>
      <h1 className="text-2xl font-bold text-ink tracking-tight mt-3 mb-6">Thêm học sinh</h1>
      <div className="rounded-md border border-border bg-canvas p-6">
        <CreateStudentForm
          onCreated={handleCreated}
          onCancel={() => router.push("/students")}
        />
      </div>
    </div>
  );
}
