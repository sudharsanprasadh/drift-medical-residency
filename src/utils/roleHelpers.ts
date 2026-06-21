import { UserRole } from '../types';

/**
 * Check if a user has leadership/management privileges
 * Leadership roles: chief_resident, program_coordinator, program_director, admin
 */
export const isLeadershipRole = (role: UserRole | null | undefined): boolean => {
  if (!role) return false;
  return ['chief_resident', 'program_coordinator', 'program_director', 'admin'].includes(role);
};

/**
 * Check if a user can manage program-level features
 * (approvals, announcements, events)
 */
export const canManageProgram = (role: UserRole | null | undefined): boolean => {
  return isLeadershipRole(role);
};

/**
 * Check if a user is a system admin
 */
export const isAdmin = (role: UserRole | null | undefined): boolean => {
  return role === 'admin';
};

/**
 * Check if a user has view-only privileges
 * View-only roles: resident, faculty
 */
export const isViewOnlyRole = (role: UserRole | null | undefined): boolean => {
  if (!role) return false;
  return ['resident', 'faculty'].includes(role);
};

/**
 * Format role name for display
 */
export const formatRoleName = (role: UserRole): string => {
  const roleMap: Record<UserRole, string> = {
    resident: 'Resident',
    faculty: 'Faculty',
    chief_resident: 'Chief Resident',
    program_coordinator: 'Program Coordinator',
    program_director: 'Program Director',
    admin: 'Admin',
  };
  return roleMap[role] || role;
};

/**
 * Get all available roles for selection
 */
export const getAllRoles = (): UserRole[] => {
  return ['resident', 'faculty', 'chief_resident', 'program_coordinator', 'program_director'];
};

/**
 * Get role description for UI
 */
export const getRoleDescription = (role: UserRole): string => {
  const descriptions: Record<UserRole, string> = {
    resident: 'View program content and your own approval status',
    faculty: 'View program content and your own approval status',
    chief_resident: 'Manage approvals, create announcements, and manage events',
    program_coordinator: 'Manage approvals, create announcements, and manage events',
    program_director: 'Manage approvals, create announcements, and manage events',
    admin: 'Full system access across all programs',
  };
  return descriptions[role] || '';
};
