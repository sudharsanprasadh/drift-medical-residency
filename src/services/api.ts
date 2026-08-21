import { supabase } from './supabase';
import {
  Program,
  Profile,
  ApprovalRequest,
  Specialty,
  PGYLevel,
  ScheduleWeek,
  ScheduleRole,
  ScheduleAssignment,
  ScheduleAssignmentResident,
  ShiftSwapRequest,
  ScheduleGridCell,
  ResidentScheduleItem,
  ShiftPeriod,
  ScheduleStatus,
  ScheduleRotationConstraint,
  ScheduleRotationTracking,
  ScheduleRotationTemplate,
  ScheduleGenerationJob,
  ComplianceSummary,
  ConstraintType,
  RotationAlgorithm,
} from '../types';

// ============================================
// PROFILE OPERATIONS
// ============================================

export const updateProfile = async (userId: string, updates: Partial<Profile>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const completeProfile = async (
  userId: string,
  profileData: {
    first_name: string;
    last_name: string;
    phone_number: string;
    role: 'resident' | 'chief_resident' | 'program_coordinator' | 'program_director' | 'faculty';
    specialty: string;
    program_id: string;
    pgy: PGYLevel;
  }
) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...profileData,
      is_profile_complete: true,
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ============================================
// PROGRAM OPERATIONS
// ============================================

export const searchPrograms = async (query: string, limit: number = 20): Promise<Program[]> => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .or(`program_name.ilike.%${query}%,specialty.ilike.%${query}%,location.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data || [];
};

export const getProgram = async (programId: string): Promise<Program> => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .single();

  if (error) throw error;
  return data;
};

// ============================================
// SPECIALTY OPERATIONS
// ============================================

export const getSpecialties = async (): Promise<Specialty[]> => {
  const { data, error } = await supabase
    .from('specialties')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
};

// ============================================
// PROGRAM MEMBERS OPERATIONS
// ============================================

/**
 * Get all approved members of a specific program
 */
export const getProgramMembers = async (programId: string): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('program_id', programId)
    .eq('is_approved', true)
    .eq('is_profile_complete', true)
    .order('role', { ascending: false }) // admin, program_coordinator, chief_resident, resident
    .order('last_name', { ascending: true });

  if (error) throw error;
  return data || [];
};

// ============================================
// APPROVAL OPERATIONS
// ============================================

/**
 * Get pending approval requests.
 * RLS policies automatically filter:
 * - Admins: See all pending requests
 * - Chief Residents: Only see requests from their own program
 * - Residents: Only see their own requests
 */
export const getPendingApprovals = async (): Promise<ApprovalRequest[]> => {
  const { data, error } = await supabase
    .from('approval_requests')
    .select(`
      *,
      profile:user_id(
        *,
        program:programs(*)
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const approveUser = async (
  requestId: string,
  userId: string,
  reviewerId: string,
  notes?: string
) => {
  // Update approval request
  const { error: requestError } = await supabase
    .from('approval_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      notes,
    })
    .eq('id', requestId);

  if (requestError) throw requestError;

  // Update user profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ is_approved: true })
    .eq('id', userId);

  if (profileError) throw profileError;
};

export const rejectUser = async (
  requestId: string,
  reviewerId: string,
  notes: string
) => {
  const { error } = await supabase
    .from('approval_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      notes,
    })
    .eq('id', requestId);

  if (error) throw error;
};

export const getUserApprovalStatus = async (userId: string): Promise<ApprovalRequest | null> => {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
};

// ============================================
// SCHEDULING OPERATIONS
// ============================================

// ============================================
// Schedule Weeks
// ============================================

export const getScheduleWeeks = async (
  programId: string,
  status?: ScheduleStatus
): Promise<ScheduleWeek[]> => {
  let query = supabase
    .from('schedule_weeks')
    .select(`
      *,
      program:programs(*),
      creator:profiles(*)
    `)
    .eq('program_id', programId)
    .order('start_date', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getScheduleWeekById = async (weekId: string): Promise<ScheduleWeek | null> => {
  const { data, error } = await supabase
    .from('schedule_weeks')
    .select(`
      *,
      program:programs(*),
      creator:profiles(*)
    `)
    .eq('id', weekId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const createScheduleWeek = async (
  weekData: {
    program_id: string;
    week_name: string;
    start_date: string;
    end_date: string;
    notes?: string;
    created_by: string;
  }
): Promise<ScheduleWeek> => {
  const { data, error } = await supabase
    .from('schedule_weeks')
    .insert(weekData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateScheduleWeek = async (
  weekId: string,
  updates: Partial<ScheduleWeek>
): Promise<ScheduleWeek> => {
  const { data, error } = await supabase
    .from('schedule_weeks')
    .update(updates)
    .eq('id', weekId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteScheduleWeek = async (weekId: string): Promise<void> => {
  const { error } = await supabase
    .from('schedule_weeks')
    .delete()
    .eq('id', weekId);

  if (error) throw error;
};

export const publishScheduleWeek = async (weekId: string): Promise<ScheduleWeek> => {
  return updateScheduleWeek(weekId, { status: 'published' });
};

export const duplicateScheduleWeek = async (
  weekId: string,
  numberOfWeeks: number,
  startDate: Date,
  createdBy: string
): Promise<ScheduleWeek[]> => {
  // Get the original week with all assignments
  const { data: originalWeek, error: weekError } = await supabase
    .from('schedule_weeks')
    .select('*')
    .eq('id', weekId)
    .single();

  if (weekError) throw weekError;

  // Get all assignments for the original week
  const { data: assignments, error: assignmentsError } = await supabase
    .from('schedule_assignments')
    .select(`
      *,
      residents:schedule_assignment_residents(*)
    `)
    .eq('schedule_week_id', weekId);

  if (assignmentsError) throw assignmentsError;

  const createdWeeks: ScheduleWeek[] = [];

  // Calculate week duration
  const originalStart = new Date(originalWeek.start_date);
  const originalEnd = new Date(originalWeek.end_date);
  const weekDuration = Math.ceil((originalEnd.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24));

  // Create duplicates for each week
  for (let i = 0; i < numberOfWeeks; i++) {
    // Add i weeks (7 days each) to the start date
    const newStartDate = new Date(startDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));

    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newStartDate.getDate() + weekDuration);

    // Format dates
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Generate week name
    const weekName = `Week of ${newStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${newEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Create new week
    const { data: newWeek, error: createError } = await supabase
      .from('schedule_weeks')
      .insert({
        program_id: originalWeek.program_id,
        week_name: weekName,
        start_date: formatDate(newStartDate),
        end_date: formatDate(newEndDate),
        notes: originalWeek.notes ? `Duplicated from: ${originalWeek.week_name}` : null,
        status: 'draft',
        created_by: createdBy,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Duplicate assignments
    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        const originalDate = new Date(assignment.shift_date);
        const dayOffset = Math.ceil((originalDate.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24));

        const newShiftDate = new Date(newStartDate);
        newShiftDate.setDate(newStartDate.getDate() + dayOffset);

        // Create new assignment
        const { data: newAssignment, error: assignError } = await supabase
          .from('schedule_assignments')
          .insert({
            schedule_week_id: newWeek.id,
            role_id: assignment.role_id,
            shift_date: formatDate(newShiftDate),
            shift_period: assignment.shift_period,
          })
          .select()
          .single();

        if (assignError) throw assignError;

        // Duplicate resident assignments
        if (assignment.residents && assignment.residents.length > 0) {
          const residentInserts = assignment.residents.map((resident: any) => ({
            assignment_id: newAssignment.id,
            resident_id: resident.resident_id,
            is_backup: resident.is_backup,
          }));

          const { error: residentError } = await supabase
            .from('schedule_assignment_residents')
            .insert(residentInserts);

          if (residentError) throw residentError;
        }
      }
    }

    createdWeeks.push(newWeek);
  }

  return createdWeeks;
};

// ============================================
// Schedule Roles
// ============================================

export const getScheduleRoles = async (programId: string): Promise<ScheduleRole[]> => {
  const { data, error } = await supabase
    .from('schedule_roles')
    .select('*')
    .eq('program_id', programId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createScheduleRole = async (
  roleData: {
    program_id: string;
    role_name: string;
    display_order?: number;
  }
): Promise<ScheduleRole> => {
  const { data, error } = await supabase
    .from('schedule_roles')
    .insert(roleData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateScheduleRole = async (
  roleId: string,
  updates: Partial<ScheduleRole>
): Promise<ScheduleRole> => {
  const { data, error } = await supabase
    .from('schedule_roles')
    .update(updates)
    .eq('id', roleId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteScheduleRole = async (roleId: string): Promise<void> => {
  const { error } = await supabase
    .from('schedule_roles')
    .update({ is_active: false })
    .eq('id', roleId);

  if (error) throw error;
};

export const seedDefaultScheduleRoles = async (programId: string): Promise<void> => {
  const { error } = await supabase.rpc('seed_default_schedule_roles', {
    p_program_id: programId,
  });

  if (error) throw error;
};

// ============================================
// Schedule Assignments
// ============================================

export const getScheduleAssignments = async (
  weekId: string
): Promise<ScheduleAssignment[]> => {
  const { data, error } = await supabase
    .from('schedule_assignments')
    .select(`
      *,
      role:schedule_roles(*),
      residents:schedule_assignment_residents(
        *,
        resident:profiles(*)
      )
    `)
    .eq('schedule_week_id', weekId)
    .order('shift_date', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createScheduleAssignment = async (
  assignmentData: {
    schedule_week_id: string;
    role_id: string;
    shift_date: string;
    shift_period: ShiftPeriod;
    notes?: string;
  }
): Promise<ScheduleAssignment> => {
  const { data, error } = await supabase
    .from('schedule_assignments')
    .insert(assignmentData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateScheduleAssignment = async (
  assignmentId: string,
  updates: Partial<ScheduleAssignment>
): Promise<ScheduleAssignment> => {
  const { data, error } = await supabase
    .from('schedule_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteScheduleAssignment = async (assignmentId: string): Promise<void> => {
  const { error } = await supabase
    .from('schedule_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;
};

// ============================================
// Schedule Assignment Residents
// ============================================

export const addResidentToAssignment = async (
  assignmentId: string,
  residentId: string,
  isBackup: boolean = false
): Promise<ScheduleAssignmentResident> => {
  const { data, error } = await supabase
    .from('schedule_assignment_residents')
    .insert({
      assignment_id: assignmentId,
      resident_id: residentId,
      is_backup: isBackup,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const removeResidentFromAssignment = async (
  assignmentResidentId: string
): Promise<void> => {
  const { error } = await supabase
    .from('schedule_assignment_residents')
    .delete()
    .eq('id', assignmentResidentId);

  if (error) throw error;
};

export const updateAssignmentResident = async (
  assignmentResidentId: string,
  isBackup: boolean
): Promise<ScheduleAssignmentResident> => {
  const { data, error } = await supabase
    .from('schedule_assignment_residents')
    .update({ is_backup: isBackup })
    .eq('id', assignmentResidentId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ============================================
// Schedule Grid View
// ============================================

export const getScheduleWeekGrid = async (weekId: string): Promise<ScheduleGridCell[]> => {
  const { data, error } = await supabase.rpc('get_schedule_week_grid', {
    p_week_id: weekId,
  });

  if (error) throw error;
  return data || [];
};

// ============================================
// Resident Schedule View
// ============================================

export const getResidentSchedule = async (
  residentId: string,
  startDate: string,
  endDate: string
): Promise<ResidentScheduleItem[]> => {
  const { data, error } = await supabase.rpc('get_resident_weekly_schedule', {
    p_resident_id: residentId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;
  return data || [];
};

// ============================================
// Shift Swap Requests
// ============================================

export const getShiftSwapRequests = async (
  userId: string,
  type: 'all' | 'outgoing' | 'incoming' = 'all'
): Promise<ShiftSwapRequest[]> => {
  let query = supabase
    .from('shift_swap_requests')
    .select(`
      *,
      requester:profiles!requester_id(*),
      target_resident:profiles!target_resident_id(*),
      approver:profiles!approved_by(*)
    `)
    .order('created_at', { ascending: false });

  if (type === 'outgoing') {
    query = query.eq('requester_id', userId);
  } else if (type === 'incoming') {
    query = query.eq('target_resident_id', userId);
  } else {
    query = query.or(`requester_id.eq.${userId},target_resident_id.eq.${userId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createShiftSwapRequest = async (
  requestData: {
    requester_id: string;
    requester_assignment_id: string;
    target_resident_id: string;
    target_assignment_id?: string;
    reason?: string;
  }
): Promise<ShiftSwapRequest> => {
  const { data, error } = await supabase
    .from('shift_swap_requests')
    .insert(requestData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const targetRespondToSwap = async (
  swapId: string,
  accept: boolean,
  targetResponse?: string
): Promise<ShiftSwapRequest> => {
  const { data, error } = await supabase
    .from('shift_swap_requests')
    .update({
      status: accept ? 'pending_chief' : 'rejected',
      target_response: targetResponse,
      target_responded_at: new Date().toISOString(),
    })
    .eq('id', swapId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const chiefApproveSwap = async (
  swapId: string,
  approve: boolean,
  chiefId: string,
  adminNotes?: string
): Promise<ShiftSwapRequest> => {
  const { data, error } = await supabase
    .from('shift_swap_requests')
    .update({
      status: approve ? 'approved' : 'rejected',
      approved_by: chiefId,
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', swapId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const cancelShiftSwapRequest = async (swapId: string): Promise<ShiftSwapRequest> => {
  const { data, error } = await supabase
    .from('shift_swap_requests')
    .update({ status: 'cancelled' })
    .eq('id', swapId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ============================================
// ROTATION SYSTEM OPERATIONS
// ============================================

// ============================================
// Rotation Constraints
// ============================================

export const getRotationConstraints = async (
  weekId: string
): Promise<ScheduleRotationConstraint[]> => {
  const { data, error } = await supabase
    .from('schedule_rotation_constraints')
    .select(`
      *,
      resident:profiles!resident_id(*),
      role:schedule_roles(*),
      paired_resident:profiles!paired_resident_id(*)
    `)
    .eq('schedule_week_id', weekId);

  if (error) throw error;
  return data || [];
};

export const createRotationConstraint = async (
  constraintData: {
    schedule_week_id?: string;
    resident_id: string;
    constraint_type: ConstraintType;
    role_id?: string;
    paired_resident_id?: string;
    constraint_value?: string;
    start_date?: string;
    end_date?: string;
    notes?: string;
  }
): Promise<ScheduleRotationConstraint> => {
  const { data, error } = await supabase
    .from('schedule_rotation_constraints')
    .insert(constraintData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteRotationConstraint = async (constraintId: string): Promise<void> => {
  const { error } = await supabase
    .from('schedule_rotation_constraints')
    .delete()
    .eq('id', constraintId);

  if (error) throw error;
};

// ============================================
// Rotation Tracking
// ============================================

export const getResidentTracking = async (
  residentId: string,
  startDate?: string,
  endDate?: string
): Promise<ScheduleRotationTracking[]> => {
  let query = supabase
    .from('schedule_rotation_tracking')
    .select(`
      *,
      resident:profiles(*),
      week:schedule_weeks(*)
    `)
    .eq('resident_id', residentId)
    .order('week_start_date', { ascending: false });

  if (startDate) {
    query = query.gte('week_start_date', startDate);
  }
  if (endDate) {
    query = query.lte('week_end_date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getProgramTracking = async (
  programId: string,
  weekId?: string
): Promise<ScheduleRotationTracking[]> => {
  let query = supabase
    .from('schedule_rotation_tracking')
    .select(`
      *,
      resident:profiles(*),
      week:schedule_weeks(*)
    `)
    .eq('week.program_id', programId)
    .order('week_start_date', { ascending: false });

  if (weekId) {
    query = query.eq('schedule_week_id', weekId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const updateResidentTracking = async (weekId: string, residentId: string): Promise<void> => {
  const { error} = await supabase.rpc('update_resident_tracking', {
    p_resident_id: residentId,
    p_week_id: weekId,
  });

  if (error) throw error;
};

export const updateWeekTracking = async (weekId: string): Promise<void> => {
  const { error } = await supabase.rpc('update_week_tracking', {
    p_week_id: weekId,
  });

  if (error) throw error;
};

export const getComplianceSummary = async (
  programId: string,
  startDate?: string,
  endDate?: string
): Promise<ComplianceSummary> => {
  const { data, error } = await supabase.rpc('get_program_compliance_summary', {
    p_program_id: programId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) throw error;
  return data?.[0] || {
    total_residents: 0,
    compliant_residents: 0,
    non_compliant_residents: 0,
    total_weeks: 0,
    compliant_weeks: 0,
    compliance_rate: 0,
    common_violations: [],
  };
};

// ============================================
// Rotation Templates
// ============================================

export const getRotationTemplates = async (programId: string): Promise<ScheduleRotationTemplate[]> => {
  const { data, error } = await supabase
    .from('schedule_rotation_templates')
    .select(`
      *,
      program:programs(*),
      base_week:schedule_weeks(*),
      creator:profiles(*)
    `)
    .eq('program_id', programId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createRotationTemplate = async (
  templateData: {
    program_id: string;
    template_name: string;
    description?: string;
    base_week_id?: string;
    algorithm?: RotationAlgorithm;
    weeks_to_generate?: number;
    auto_seed_constraints?: boolean;
    created_by: string;
  }
): Promise<ScheduleRotationTemplate> => {
  const { data, error } = await supabase
    .from('schedule_rotation_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateRotationTemplate = async (
  templateId: string,
  updates: Partial<ScheduleRotationTemplate>
): Promise<ScheduleRotationTemplate> => {
  const { data, error } = await supabase
    .from('schedule_rotation_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteRotationTemplate = async (templateId: string): Promise<void> => {
  const { error } = await supabase
    .from('schedule_rotation_templates')
    .update({ is_active: false })
    .eq('id', templateId);

  if (error) throw error;
};

// ============================================
// Generation Jobs
// ============================================

export const getGenerationJobs = async (programId: string): Promise<ScheduleGenerationJob[]> => {
  const { data, error } = await supabase
    .from('schedule_generation_jobs')
    .select(`
      *,
      template:schedule_rotation_templates(*),
      program:programs(*),
      creator:profiles(*)
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
};

export const createGenerationJob = async (
  jobData: {
    template_id?: string;
    program_id: string;
    start_date: string;
    weeks_to_generate: number;
    created_by: string;
  }
): Promise<ScheduleGenerationJob> => {
  const { data, error } = await supabase
    .from('schedule_generation_jobs')
    .insert(jobData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateGenerationJob = async (
  jobId: string,
  updates: Partial<ScheduleGenerationJob>
): Promise<ScheduleGenerationJob> => {
  const { data, error } = await supabase
    .from('schedule_generation_jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
