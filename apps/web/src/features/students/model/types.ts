export interface Student {
  id: string;
  organization_id: string;
  name: string;
  date_of_birth: string | null;
  note: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface ParentRequest {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
}

export interface CreateStudentRequest {
  name: string;
  date_of_birth?: string | null;
  note?: string | null;
  parent?: ParentRequest | null;
}
