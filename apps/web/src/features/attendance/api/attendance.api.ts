import { apiClient } from "@/src/shared/api/client";
import type { AttendanceRecord, AttendanceRecordIn, ClassSession } from "../model/types";

export async function createSessionApi(
  classId: string,
  date: string,
  options?: {
    notes?: string | null;
    mode?: "online" | "offline";
    start_time?: string | null;
  },
): Promise<ClassSession> {
  const { data } = await apiClient.post<ClassSession>(`/classes/${classId}/sessions`, {
    date,
    notes: options?.notes ?? null,
    mode: options?.mode ?? "offline",
    start_time: options?.start_time ?? null,
  });
  return data;
}

export async function listSessionsApi(classId: string): Promise<ClassSession[]> {
  const { data } = await apiClient.get<ClassSession[]>(`/classes/${classId}/sessions`);
  return data;
}

export async function getSessionApi(classId: string, sessionId: string): Promise<ClassSession> {
  const { data } = await apiClient.get<ClassSession>(
    `/classes/${classId}/sessions/${sessionId}`,
  );
  return data;
}

export async function updateSessionApi(
  classId: string,
  sessionId: string,
  body: { notes?: string | null; mode?: "online" | "offline"; start_time?: string | null },
): Promise<ClassSession> {
  const { data } = await apiClient.patch<ClassSession>(
    `/classes/${classId}/sessions/${sessionId}`,
    body,
  );
  return data;
}

export async function notifyMeetApi(
  classId: string,
  sessionId: string,
): Promise<{ sent: boolean; message: string }> {
  const { data } = await apiClient.post<{ sent: boolean; message: string }>(
    `/classes/${classId}/sessions/${sessionId}/notify-meet`,
  );
  return data;
}

export async function markAttendanceApi(
  classId: string,
  sessionId: string,
  records: AttendanceRecordIn[],
): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.put<AttendanceRecord[]>(
    `/classes/${classId}/sessions/${sessionId}/attendance`,
    { records },
  );
  return data;
}

export async function listAttendanceApi(
  classId: string,
  sessionId: string,
): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.get<AttendanceRecord[]>(
    `/classes/${classId}/sessions/${sessionId}/attendance`,
  );
  return data;
}
