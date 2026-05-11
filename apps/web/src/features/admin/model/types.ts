export interface TeacherClassInfo {
  id: string;
  name: string;
  subject: string;
  academic_year: string;
  is_active: boolean;
  student_count: number;
}

export interface TeacherInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  class_count: number;
  student_count: number;
  sessions_this_month: number;
}

export interface TeacherDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  classes: TeacherClassInfo[];
  total_students: number;
}

export interface AdminDashboard {
  total_teachers: number;
  total_classes: number;
  total_students: number;
  total_active_classes: number;
  attendance_rate_this_month: number;
  sessions_this_month: number;
  teachers: TeacherInfo[];
}

export interface AttendanceReportRow {
  teacher_name: string;
  class_name: string;
  subject: string;
  total_sessions: number;
  total_attendances: number;
  present: number;
  absent: number;
  attendance_rate: number;
}

export interface GradeReportRow {
  teacher_name: string;
  class_name: string;
  subject: string;
  student_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
}

export interface OrgSettings {
  name: string;
  phone: string | null;
  address: string | null;
  academic_year: string | null;
  logo_url: string | null;
  zalo_oa_id: string | null;
  zalo_oa_token: string | null;
}

export interface CreateTeacherRequest {
  name: string;
  email: string;
  password: string;
  phone: string | null;
}

export interface UpdateTeacherRequest {
  name: string;
  email: string;
  phone: string | null;
}
