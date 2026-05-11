import { apiClient } from "@/src/shared/api/client";
import type { Feedback, Notification } from "../model/types";

export async function listNotificationsApi(): Promise<Notification[]> {
  const { data } = await apiClient.get<Notification[]>("/notifications");
  return data;
}

export async function markNotificationReadApi(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function createFeedbackApi(payload: {
  recipient_id: string;
  student_id?: string;
  notification_id?: string;
  content: string;
}): Promise<Feedback> {
  const { data } = await apiClient.post<Feedback>("/feedback", payload);
  return data;
}

export async function listFeedbackApi(): Promise<Feedback[]> {
  const { data } = await apiClient.get<Feedback[]>("/feedback");
  return data;
}

export async function replyFeedbackApi(id: string, content: string): Promise<Feedback> {
  const { data } = await apiClient.patch<Feedback>(`/feedback/${id}/reply`, { content });
  return data;
}

export async function createNotificationApi(payload: {
  recipient_id: string;
  student_id?: string;
  session_id?: string;
  content: string;
}): Promise<Notification> {
  const { data } = await apiClient.post<Notification>("/notifications", payload);
  return data;
}
