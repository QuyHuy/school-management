import { apiClient } from "@/src/shared/api/client";
import type { DashboardSummary } from "../model/types";

export async function getDashboardApi(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/dashboard");
  return data;
}
