import { apiClient } from "@/src/shared/api/client";
import type {
  AddScheduleRequest,
  Class,
  ClassSchedule,
  CreateClassRequest,
  Enrollment,
} from "../model/types";

export async function listClassesApi(): Promise<Class[]> {
  const { data } = await apiClient.get<Class[]>("/classes");
  return data;
}

export async function createClassApi(body: CreateClassRequest): Promise<Class> {
  const { data } = await apiClient.post<Class>("/classes", body);
  return data;
}

export async function getClassApi(id: string): Promise<Class> {
  const { data } = await apiClient.get<Class>(`/classes/${id}`);
  return data;
}

export async function listSchedulesApi(classId: string): Promise<ClassSchedule[]> {
  const { data } = await apiClient.get<ClassSchedule[]>(`/classes/${classId}/schedules`);
  return data;
}

export async function addScheduleApi(classId: string, body: AddScheduleRequest): Promise<ClassSchedule> {
  const { data } = await apiClient.post<ClassSchedule>(`/classes/${classId}/schedules`, body);
  return data;
}

export async function deleteScheduleApi(classId: string, scheduleId: string): Promise<void> {
  await apiClient.delete(`/classes/${classId}/schedules/${scheduleId}`);
}

export async function listEnrollmentsApi(classId: string): Promise<Enrollment[]> {
  const { data } = await apiClient.get<Enrollment[]>(`/classes/${classId}/enrollments`);
  return data;
}

export async function enrollStudentApi(classId: string, studentId: string): Promise<Enrollment> {
  const { data } = await apiClient.post<Enrollment>(`/classes/${classId}/enrollments`, {
    student_id: studentId,
  });
  return data;
}

export async function unenrollStudentApi(classId: string, studentId: string): Promise<void> {
  await apiClient.delete(`/classes/${classId}/enrollments/${studentId}`);
}
