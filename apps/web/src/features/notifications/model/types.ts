export interface Notification {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  session_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface Feedback {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  notification_id: string | null;
  content: string;
  reply_content: string | null;
  replied_by_id: string | null;
  replied_at: string | null;
  created_at: string;
}
