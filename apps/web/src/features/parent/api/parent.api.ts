import { apiClient } from "@/src/shared/api/client";
import type { ChildAttendanceRow, ChildGradeRow, ChildInfo } from "../model/types";

export async function listChildrenApi(): Promise<ChildInfo[]> {
  const { data } = await apiClient.get<ChildInfo[]>("/parent/children");
  return data;
}

export async function getChildGradesApi(studentId: string): Promise<ChildGradeRow[]> {
  const { data } = await apiClient.get<ChildGradeRow[]>(`/parent/children/${studentId}/grades`);
  return data;
}

export async function getChildAttendanceApi(studentId: string): Promise<ChildAttendanceRow[]> {
  const { data } = await apiClient.get<ChildAttendanceRow[]>(`/parent/children/${studentId}/attendance`);
  return data;
}
