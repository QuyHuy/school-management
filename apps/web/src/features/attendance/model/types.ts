export type AttendanceStatus = "present" | "absent" | "late";

export interface ClassSession {
  id: string;
  class_id: string;
  date: string;
  notes: string | null;
  created_at: string;
  mode: "online" | "offline";
  start_time: string | null;
  meet_link: string | null;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
  marked_at: string;
}

export interface AttendanceRecordIn {
  student_id: string;
  status: AttendanceStatus;
  note?: string;
}
