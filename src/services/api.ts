import { supabase } from './supabase';
import { Program, Profile, ApprovalRequest, Specialty, PGYLevel } from '../types';

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
      profile:profiles!approval_requests_user_id_fkey(
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
