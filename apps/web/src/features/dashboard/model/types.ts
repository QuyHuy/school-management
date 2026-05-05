export interface TodayClass {
  class_id: string;
  class_name: string;
  subject: string;
  start_time: string;
  end_time: string;
}

export interface PendingSession {
  session_id: string;
  class_id: string;
  class_name: string;
  date: string;
}

export interface DashboardSummary {
  active_classes_count: number;
  total_students_count: number;
  today_schedule: TodayClass[];
  pending_sessions: PendingSession[];
}
