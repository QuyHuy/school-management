import { apiClient } from "@/src/shared/api/client";
import type {
  AdminDashboard,
  AttendanceReportRow,
  CreateTeacherRequest,
  GradeReportRow,
  OrgSettings,
  TeacherDetail,
  TeacherInfo,
  UpdateTeacherRequest,
} from "../model/types";

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await apiClient.get<AdminDashboard>("/admin/dashboard");
  return data;
}

export async function listTeachers(): Promise<TeacherInfo[]> {
  const { data } = await apiClient.get<TeacherInfo[]>("/admin/teachers");
  return data;
}

export async function getTeacher(id: string): Promise<TeacherDetail> {
  const { data } = await apiClient.get<TeacherDetail>(`/admin/teachers/${id}`);
  return data;
}

export async function createTeacher(body: CreateTeacherRequest): Promise<TeacherDetail> {
  const { data } = await apiClient.post<TeacherDetail>("/admin/teachers", body);
  return data;
}

export async function updateTeacher(id: string, body: UpdateTeacherRequest): Promise<TeacherDetail> {
  const { data } = await apiClient.patch<TeacherDetail>(`/admin/teachers/${id}`, body);
  return data;
}

export async function resetTeacherPassword(id: string, newPassword: string): Promise<void> {
  await apiClient.post(`/admin/teachers/${id}/reset-password`, { new_password: newPassword });
}

export async function toggleTeacher(id: string): Promise<TeacherDetail> {
  const { data } = await apiClient.patch<TeacherDetail>(`/admin/teachers/${id}/deactivate`);
  return data;
}

export async function getAttendanceReport(params: {
  date_from?: string;
  date_to?: string;
  teacher_id?: string;
  class_id?: string;
}): Promise<AttendanceReportRow[]> {
  const { data } = await apiClient.get<{ rows: AttendanceReportRow[] }>(
    "/admin/reports/attendance",
    { params },
  );
  return data.rows;
}

export async function getGradesReport(params: {
  teacher_id?: string;
  class_id?: string;
}): Promise<GradeReportRow[]> {
  const { data } = await apiClient.get<{ rows: GradeReportRow[] }>(
    "/admin/reports/grades",
    { params },
  );
  return data.rows;
}

export async function getSettings(): Promise<OrgSettings> {
  const { data } = await apiClient.get<OrgSettings>("/admin/settings");
  return data;
}

export async function updateSettings(body: Partial<OrgSettings>): Promise<OrgSettings> {
  const { data } = await apiClient.patch<OrgSettings>("/admin/settings", body);
  return data;
}
