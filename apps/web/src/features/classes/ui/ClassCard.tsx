import Link from "next/link";
import type { Class } from "../model/types";

interface Props {
  class_: Class;
}

export function ClassCard({ class_ }: Props) {
  return (
    <Link
      href={`/classes/${class_.id}`}
      className="block rounded-md border border-border bg-canvas p-4 hover:border-ink transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-ink">{class_.name}</h3>
          <p className="text-sm text-ash mt-0.5">{class_.subject} · {class_.academic_year}</p>
        </div>
        {class_.is_active ? (
          <span className="text-xs font-medium text-success bg-success/10 rounded px-2 py-0.5">
            Đang học
          </span>
        ) : (
          <span className="text-xs font-medium text-ash bg-surface rounded px-2 py-0.5">
            Kết thúc
          </span>
        )}
      </div>
    </Link>
  );
}
