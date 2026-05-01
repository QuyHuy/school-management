export interface Class {
  id: string;
  organization_id: string;
  teacher_id: string;
  name: string;
  subject: string;
  academic_year: string;
  is_active: boolean;
  created_at: string;
}

export interface ClassSchedule {
  id: string;
  class_id: string;
  day_of_week: number;  // 0=Mon … 6=Sun
  start_time: string;   // "HH:MM:SS"
  end_time: string;
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  parent_id: string | null;
  enrolled_at: string;
}

export interface CreateClassRequest {
  name: string;
  subject: string;
  academic_year: string;
}

export interface AddScheduleRequest {
  day_of_week: number;
  start_time: string;
  end_time: string;
}
