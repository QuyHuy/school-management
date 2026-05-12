import { apiClient } from "@/src/shared/api/client";
import type { AttendanceRecord, AttendanceRecordIn, ClassSession } from "../model/types";

export async function createSessionApi(
  classId: string,
  date: string,
  notes?: string,
): Promise<ClassSession> {
  const { data } = await apiClient.post<ClassSession>(
    `/classes/${classId}/sessions`,
    { date, notes: notes ?? null },
  );
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

export async function patchSessionNotesApi(
  classId: string,
  sessionId: string,
  notes: string | null,
): Promise<ClassSession> {
  const { data } = await apiClient.patch(
    `/classes/${classId}/sessions/${sessionId}`,
    { notes },
  );
  return data;
}
