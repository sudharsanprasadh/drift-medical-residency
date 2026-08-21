export type UserRole = 'resident' | 'chief_resident' | 'program_coordinator' | 'program_director' | 'faculty' | 'admin';
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
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearPasswordRecovery: () => void;
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

export type EventType =
  | 'conference'
  | 'meeting'
  | 'social'
  | 'educational'
  | 'grand_rounds'
  | 'morning_report'
  | 'other';

export type EventVisibility = 'public' | 'private';

export interface Event {
  id: string;
  program_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string; // ISO date string
  event_time: string; // HH:MM:SS format
  duration_minutes: number | null;
  venue: string;
  visibility: EventVisibility;
  contact_info: string | null;
  notes: string | null;
  is_published: boolean;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  program?: Program;
}

// ============================================
// SCHEDULING TYPES
// ============================================

export type ShiftPeriod = 'day' | 'night' | 'day_night';
export type ScheduleStatus = 'draft' | 'published' | 'archived';
export type SwapStatus = 'pending_target' | 'pending_chief' | 'approved' | 'rejected' | 'cancelled';

export interface ScheduleWeek {
  id: string;
  program_id: string;
  week_name: string;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  status: ScheduleStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  program?: Program;
  creator?: Profile;
}

export interface ScheduleRole {
  id: string;
  program_id: string;
  role_name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleAssignment {
  id: string;
  schedule_week_id: string;
  role_id: string;
  shift_date: string; // ISO date string
  shift_period: ShiftPeriod;
  notes: string | null;
  created_at: string;
  updated_at: string;
  role?: ScheduleRole;
  residents?: ScheduleAssignmentResident[];
}

export interface ScheduleAssignmentResident {
  id: string;
  assignment_id: string;
  resident_id: string;
  is_backup: boolean;
  created_at: string;
  resident?: Profile;
}

export interface ShiftSwapRequest {
  id: string;
  requester_id: string;
  requester_assignment_id: string;
  target_resident_id: string;
  target_assignment_id: string | null;
  status: SwapStatus;
  reason: string | null;
  target_response: string | null;
  target_responded_at: string | null;
  approved_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile;
  target_resident?: Profile;
  requester_assignment?: ScheduleAssignmentResident;
  target_assignment?: ScheduleAssignmentResident;
  approver?: Profile;
}

// Grid view helper type for displaying schedule
export interface ScheduleGridCell {
  shift_date: string;
  role_id: string;
  role_name: string;
  day_residents: string[];
  day_backup_residents: string[];
  night_residents: string[];
  night_backup_residents: string[];
  day_night_residents: string[];
  day_night_backup_residents: string[];
  day_notes: string | null;
  night_notes: string | null;
}

// Resident's personal schedule view
export interface ResidentScheduleItem {
  week_id: string;
  week_name: string;
  shift_date: string;
  role_name: string;
  shift_period: ShiftPeriod;
  is_backup: boolean;
  notes: string | null;
}

// ============================================
// ROTATION SYSTEM TYPES
// ============================================

export type ConstraintType =
  | 'excluded_role'
  | 'required_pair'
  | 'max_nights_per_month'
  | 'preferred_off_day'
  | 'vacation_block'
  | 'max_consecutive_nights'
  | 'min_days_off_per_week';

export type RotationAlgorithm = 'smart_balanced' | 'round_robin' | 'custom';

export type GenerationJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScheduleRotationConstraint {
  id: string;
  schedule_week_id: string | null;
  resident_id: string;
  constraint_type: ConstraintType;
  role_id: string | null;
  paired_resident_id: string | null;
  constraint_value: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resident?: Profile;
  role?: ScheduleRole;
  paired_resident?: Profile;
}

export interface ScheduleRotationTracking {
  id: string;
  resident_id: string;
  schedule_week_id: string;
  week_start_date: string;
  week_end_date: string;
  total_hours: number;
  day_shift_hours: number;
  night_shift_hours: number;
  max_continuous_hours: number;
  total_shifts: number;
  day_shifts: number;
  night_shifts: number;
  consecutive_work_days: number;
  consecutive_nights: number;
  days_off_count: number;
  weekend_shifts: number;
  is_compliant: boolean;
  violation_notes: string[];
  rolling_4week_hours: number;
  rolling_4week_nights: number;
  created_at: string;
  updated_at: string;
  resident?: Profile;
  week?: ScheduleWeek;
}

export interface ScheduleRotationTemplate {
  id: string;
  program_id: string;
  template_name: string;
  description: string | null;
  base_week_id: string | null;
  algorithm: RotationAlgorithm;
  weeks_to_generate: number;
  auto_seed_constraints: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  program?: Program;
  base_week?: ScheduleWeek;
  creator?: Profile;
}

export interface ScheduleGenerationJob {
  id: string;
  template_id: string | null;
  program_id: string;
  start_date: string;
  weeks_to_generate: number;
  weeks_completed: number;
  status: GenerationJobStatus;
  error_message: string | null;
  compliance_summary: any; // JSONB
  created_by: string | null;
  created_at: string;
  updated_at: string;
  template?: ScheduleRotationTemplate;
  program?: Program;
  creator?: Profile;
}

export interface ComplianceSummary {
  total_residents: number;
  compliant_residents: number;
  non_compliant_residents: number;
  total_weeks: number;
  compliant_weeks: number;
  compliance_rate: number;
  common_violations: string[];
}

export type FeedbackStatus = 'new' | 'reviewed' | 'resolved' | 'dismissed';

export interface Feedback {
  id: string;
  user_id: string;
  program_id: string | null;
  title: string;
  description: string;
  name: string | null;
  status: FeedbackStatus;
  created_at: string;
}
