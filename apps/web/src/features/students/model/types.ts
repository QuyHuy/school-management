export interface ParentInfo {
  name: string;
  email: string;
  phone: string | null;
}

export interface Student {
  id: string;
  organization_id: string;
  name: string;
  student_code: string | null;
  grade: number | null;
  date_of_birth: string | null;
  note: string | null;
  parent_id: string | null;
  parent: ParentInfo | null;
  created_at: string;
}

export interface ParentRequest {
  phone: string;
  name?: string | null;
  email?: string | null;
  password?: string | null;
}

export interface CheckParentResponse {
  exists: boolean;
  is_parent: boolean;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface CreateStudentRequest {
  name: string;
  grade: number;
  date_of_birth?: string | null;
  note?: string | null;
  parent?: ParentRequest | null;
}

export interface ImportPreviewRow {
  row: number;
  name: string;
  grade: number | null;
  date_of_birth: string | null;
  note: string | null;
  errors: string[];
}

export interface ImportPreviewResponse {
  valid: ImportPreviewRow[];
  invalid: ImportPreviewRow[];
  total_rows: number;
}

export interface ImportConfirmResponse {
  created: number;
  failed: { row: number; error: string }[];
}
