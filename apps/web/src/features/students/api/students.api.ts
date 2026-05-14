import { apiClient } from "@/src/shared/api/client";
import type { CheckParentResponse, CreateStudentRequest, ImportConfirmResponse, ImportPreviewResponse, ImportPreviewRow, ParentRequest, Student } from "../model/types";

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

export async function checkParentPhoneApi(phone: string): Promise<CheckParentResponse> {
  const { data } = await apiClient.get<CheckParentResponse>(
    `/students/check-parent?phone=${encodeURIComponent(phone)}`
  );
  return data;
}

export async function downloadStudentTemplateApi(): Promise<void> {
  const { data } = await apiClient.get("/students/import/template", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_template.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export async function previewStudentImportApi(file: File): Promise<ImportPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImportPreviewResponse>("/students/import/preview", form, {
    headers: { "Content-Type": undefined },
  });
  return data;
}

export async function linkParentApi(studentId: string, body: ParentRequest): Promise<Student> {
  const { data } = await apiClient.patch<Student>(`/students/${studentId}/parent`, body);
  return data;
}

export async function confirmStudentImportApi(rows: ImportPreviewRow[]): Promise<ImportConfirmResponse> {
  const { data } = await apiClient.post<ImportConfirmResponse>("/students/import/confirm", { rows });
  return data;
}
