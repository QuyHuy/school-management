import { apiClient } from "@/src/shared/api/client";
import type { CalendarData } from "../model/types";

export async function getCalendarApi(month: string): Promise<CalendarData> {
  const { data } = await apiClient.get<CalendarData>("/calendar", {
    params: { month },
  });
  return data;
}
