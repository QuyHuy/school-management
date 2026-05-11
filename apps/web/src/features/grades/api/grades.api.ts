import { apiClient } from "@/src/shared/api/client";
import type { CreateExamRequest, Exam, Grade, GradeIn } from "../model/types";

export async function listExamsApi(classId: string): Promise<Exam[]> {
  const { data } = await apiClient.get<Exam[]>(`/classes/${classId}/exams`);
  return data;
}

export async function createExamApi(classId: string, body: CreateExamRequest): Promise<Exam> {
  const { data } = await apiClient.post<Exam>(`/classes/${classId}/exams`, body);
  return data;
}

export async function deleteExamApi(classId: string, examId: string): Promise<void> {
  await apiClient.delete(`/classes/${classId}/exams/${examId}`);
}

export async function listGradesApi(classId: string, examId: string): Promise<Grade[]> {
  const { data } = await apiClient.get<Grade[]>(`/classes/${classId}/exams/${examId}/grades`);
  return data;
}

export async function bulkUpsertGradesApi(
  classId: string,
  examId: string,
  grades: GradeIn[],
): Promise<Grade[]> {
  const { data } = await apiClient.post<Grade[]>(
    `/classes/${classId}/exams/${examId}/grades`,
    { grades },
  );
  return data;
}
