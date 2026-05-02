import { CreateClassForm } from "@/src/features/classes/ui/CreateClassForm";

export default function NewClassPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Tạo lớp mới</h1>
      <CreateClassForm />
    </div>
  );
}
