export interface ChildClass {
  class_id: string;
  name: string;
  subject: string;
  academic_year: string;
  is_active: boolean;
}

export interface ChildInfo {
  student_id: string;
  student_name: string;
  date_of_birth: string | null;
  classes: ChildClass[];
}

export interface ChildGradeRow {
  exam_id: string;
  class_id: string;
  class_name: string;
  exam_title: string;
  exam_type: string;
  exam_date: string | null;
  max_score: number;
  score: number | null;
  note: string | null;
}

export interface ChildAttendanceRow {
  session_id: string;
  class_id: string;
  class_name: string;
  date: string;
  status: "present" | "absent" | "late" | null;
  note: string | null;
}
