import { apiClient } from "@/src/shared/api/client";
import type { CreateStudentRequest, Student } from "../model/types";

export async function listStudentsApi(): Promise<Student[]> {
  const { data } = await apiClient.get<Student[]>("/students");
  return data;
}

export async function createStudentApi(body: CreateStudentRequest): Promise<Student> {
  const { data } = await apiClient.post<Student>("/students", body);
  return data;
}

export async function getStudentApi(id: string): Promise<Student> {
  const { data } = await apiClient.get<Student>(`/students/${id}`);
  return data;
}

export async function listStudentClassesApi(studentId: string): Promise<import("@/src/features/classes/model/types").Class[]> {
  const { data } = await apiClient.get(`/students/${studentId}/classes`);
  return data;
}
