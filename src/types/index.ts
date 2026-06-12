export type UserRole = 'resident' | 'chief_resident' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type PGYLevel = 'PGY0' | 'PGY1' | 'PGY2' | 'PGY3' | 'PGY4' | 'PGY5' | 'PGY6' | 'PGY7' | 'PGY8' | 'ALUMNI';

export interface Program {
  id: string;
  program_name: string;
  specialty: string;
  location: string;
  program_director: string | null;
  program_coordinator: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  role: UserRole;
  specialty: string | null;
  program_id: string | null;
  pgy: PGYLevel | null;
  is_approved: boolean;
  is_profile_complete: boolean;
  created_at: string;
  updated_at: string;
  program?: Program;
}

export interface ApprovalRequest {
  id: string;
  user_id: string;
  requested_role: UserRole;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Specialty {
  id: string;
  name: string;
  created_at: string;
}

export interface AuthContextType {
  user: any;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface Announcement {
  id: string;
  program_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
  program?: Program;
}
