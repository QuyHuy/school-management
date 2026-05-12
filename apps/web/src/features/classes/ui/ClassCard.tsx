import Link from "next/link";
import { ChevronRight, BookOpen } from "lucide-react";
import type { Class } from "../model/types";

interface Props {
  class_: Class;
}

export function ClassCard({ class_ }: Props) {
  return (
    <Link
      href={`/classes/${class_.id}`}
      className="group flex items-center justify-between rounded-md border border-border bg-canvas px-5 py-4 hover:border-stone hover:shadow-card transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-sm bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
          <BookOpen className="w-5 h-5 text-primary" strokeWidth={2} />
        </div>
        <div>
          <h3 className="font-semibold text-ink group-hover:text-primary transition-colors text-sm">
            {class_.name}
          </h3>
          <p className="text-xs text-ash mt-0.5">{class_.subject} · {class_.academic_year}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {class_.is_active ? (
          <span className="text-xs font-semibold text-success bg-success/8 rounded-full px-3 py-1 border border-success/15">
            Đang học
          </span>
        ) : (
          <span className="text-xs font-semibold text-ash bg-surface rounded-full px-3 py-1 border border-border">
            Kết thúc
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-stone group-hover:text-ash transition-colors" />
      </div>
    </Link>
  );
}
