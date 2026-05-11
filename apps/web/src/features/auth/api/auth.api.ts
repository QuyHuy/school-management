import { apiClient } from "@/src/shared/api/client";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MeResponse {
  user_id: string;
  org_id: string;
  role: "admin" | "teacher" | "parent";
}

export async function loginApi(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function loginParentApi(
  phone: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login/parent", {
    phone,
    password,
  });
  return data;
}

export interface ProfileResponse {
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
}

export async function getProfileApi(): Promise<ProfileResponse> {
  const { data } = await apiClient.get<ProfileResponse>("/auth/me/profile");
  return data;
}

export async function updateProfileApi(body: {
  name?: string;
  phone?: string;
  email?: string;
}): Promise<ProfileResponse> {
  const { data } = await apiClient.patch<ProfileResponse>("/auth/me/profile", body);
  return data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/logout", { refresh_token: refreshToken });
}

export async function getMeApi(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>("/auth/me");
  return data;
}
