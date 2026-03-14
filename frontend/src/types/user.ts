export interface User {
  id: string;
  email: string;
  display_name: string;
  credits: number;
  role: 'user' | 'admin';
  is_active: boolean;
  storage_used_bytes: number;
  created_at: string;
}

export interface UserUpdate {
  display_name?: string;
  email?: string;
}
