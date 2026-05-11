import { apiClient } from "@/src/shared/api/client";

export interface SendZaloResult {
  sent_count: number;
  skipped_count: number;
}

export async function sendZaloAttendanceNotifications(
  classId: string,
  sessionId: string
): Promise<SendZaloResult> {
  const resp = await apiClient.post(
    `/classes/${classId}/sessions/${sessionId}/attendance/send-zalo`
  );
  return resp.data as SendZaloResult;
}
