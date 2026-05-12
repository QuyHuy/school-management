"use client";

import { useParentStore } from "../model/store";

export function ChildPicker() {
  const { children, selectedId, selectChild } = useParentStore();

  if (children.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {children.map((c) => {
        const active = c.student_id === selectedId;
        return (
          <button
            key={c.student_id}
            onClick={() => selectChild(c.student_id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors border ${
              active
                ? "bg-primary text-canvas border-primary"
                : "bg-canvas text-ash border-border hover:border-ink hover:text-ink"
            }`}
          >
            {c.student_name.trim().split(" ").pop()}
          </button>
        );
      })}
    </div>
  );
}
