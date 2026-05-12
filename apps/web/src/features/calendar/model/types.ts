export interface CalendarSession {
  id: string;
  class_id: string;
  class_name: string;
  date: string;          // "YYYY-MM-DD"
  start_time: string | null;  // "HH:MM:SS"
  end_time: string | null;
  has_attendance: boolean;
}

export interface CalendarSlot {
  class_id: string;
  class_name: string;
  date: string;          // "YYYY-MM-DD"
  start_time: string;    // "HH:MM:SS"
  end_time: string;
}

export interface CalendarData {
  sessions: CalendarSession[];
  schedule_slots: CalendarSlot[];
}
