import { create } from "zustand";
import type { ChildInfo } from "./types";

interface ParentPortalState {
  children: ChildInfo[];
  selectedId: string | null;
  setChildren: (children: ChildInfo[]) => void;
  selectChild: (id: string) => void;
  reset: () => void;
}

export const useParentStore = create<ParentPortalState>()((set) => ({
  children: [],
  selectedId: null,
  setChildren: (children) =>
    set({ children, selectedId: children[0]?.student_id ?? null }),
  selectChild: (id) => set({ selectedId: id }),
  reset: () => set({ children: [], selectedId: null }),
}));
