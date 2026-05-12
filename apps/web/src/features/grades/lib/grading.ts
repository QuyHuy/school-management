import type { Exam, Grade } from "../model/types";

const EXAM_WEIGHT: Record<string, number> = {
  quiz: 1,
  midterm: 2,
  final: 3,
  // assignment: excluded (not in map)
};

export function computeWeightedAverage(
  exams: Exam[],
  gradesByExam: Record<string, Grade[]>,
  studentId: string,
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const exam of exams) {
    const weight = EXAM_WEIGHT[exam.type];
    if (!weight) continue;

    const grades = gradesByExam[exam.id] ?? [];
    const grade = grades.find((g) => g.student_id === studentId);
    if (!grade) continue;

    const score10 = (grade.score / exam.max_score) * 10;
    weightedSum += score10 * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}
