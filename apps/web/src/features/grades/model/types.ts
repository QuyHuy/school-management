export type ExamType = "quiz" | "midterm" | "final" | "assignment";

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  quiz: "Kiểm tra thường xuyên",
  midterm: "Giữa kỳ",
  final: "Cuối kỳ",
  assignment: "Bài tập",
};

export interface Exam {
  id: string;
  class_id: string;
  organization_id: string;
  title: string;
  type: ExamType;
  max_score: number;
  weight_percent: number;
  exam_date: string | null;  // "YYYY-MM-DD"
  created_at: string;
}

export interface Grade {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  note: string | null;
  graded_by: string;
  graded_at: string;
}

export interface GradeIn {
  student_id: string;
  score: number;
  note?: string | null;
}

export interface CreateExamRequest {
  title: string;
  type: ExamType;
  max_score: number;
  weight_percent: number;
  exam_date?: string | null;
}
