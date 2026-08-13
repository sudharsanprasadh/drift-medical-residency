/**
 * Smart Rotation Engine with ACGME Compliance
 *
 * This module generates weekly schedules automatically based on:
 * - Template week assignments
 * - Rotation constraints (exclusions, pairings, limits)
 * - ACGME compliance rules
 * - Hour balancing for quality of life
 */

import {
  Profile,
  ScheduleWeek,
  ScheduleRole,
  ScheduleAssignment,
  ScheduleAssignmentResident,
  ScheduleRotationConstraint,
  ScheduleRotationTracking,
  ShiftPeriod,
} from '../types';

import {
  createScheduleWeek,
  createScheduleAssignment,
  addResidentToAssignment,
  getScheduleAssignments,
  getRotationConstraints,
  getProgramMembers,
  updateWeekTracking,
} from './api';

// ============================================
// TYPES
// ============================================

interface ResidentScore {
  residentId: string;
  score: number; // Lower is better
  recentHours: number;
  recentNights: number;
  consecutiveDays: number;
  daysOffLastWeek: number;
}

interface AssignmentSlot {
  roleId: string;
  roleName: string;
  date: string;
  shiftPeriod: ShiftPeriod;
}

interface GenerationContext {
  programId: string;
  baseWeek: ScheduleWeek;
  baseAssignments: ScheduleAssignment[];
  constraints: ScheduleRotationConstraint[];
  residents: Profile[];
  trackingHistory: Map<string, ScheduleRotationTracking[]>; // residentId -> tracking[]
}

// ============================================
// CONSTANTS
// ============================================

const ACGME_MAX_HOURS_PER_WEEK = 80;
const ACGME_MAX_CONTINUOUS_HOURS = 28;
const ACGME_MIN_DAYS_OFF_PER_WEEK = 1;
const ACGME_MAX_NIGHTS_PER_WEEK = 4;
const EVERY_THIRD_NIGHT_MIN_GAP = 2; // Days

const HOURS_PER_DAY_SHIFT = 12;
const HOURS_PER_NIGHT_SHIFT = 12;

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

export async function generateRotationWeeks(
  baseWeekId: string,
  weeksToGenerate: number,
  startDate: Date,
  createdBy: string
): Promise<ScheduleWeek[]> {
  console.log(`Starting rotation generation: ${weeksToGenerate} weeks from ${startDate.toISOString()}`);

  // Load context
  const context = await loadGenerationContext(baseWeekId);

  const generatedWeeks: ScheduleWeek[] = [];
  let currentDate = new Date(startDate);

  for (let weekNum = 0; weekNum < weeksToGenerate; weekNum++) {
    console.log(`Generating week ${weekNum + 1}/${weeksToGenerate}`);

    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Create new week
    const newWeek = await createScheduleWeek({
      program_id: context.programId,
      week_name: `Week ${weekNum + 1} (${formatDate(weekStart)} - ${formatDate(weekEnd)})`,
      start_date: weekStart.toISOString().split('T')[0],
      end_date: weekEnd.toISOString().split('T')[0],
      notes: `Auto-generated from template week`,
      created_by: createdBy,
    });

    // Generate assignments for this week
    await generateWeekAssignments(newWeek, context, weekNum);

    // Update tracking
    await updateWeekTracking(newWeek.id);

    generatedWeeks.push(newWeek);

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return generatedWeeks;
}

// ============================================
// CONTEXT LOADING
// ============================================

async function loadGenerationContext(baseWeekId: string): Promise<GenerationContext> {
  // This would ideally load from API
  // For now, returning stub - will be implemented when integrated
  throw new Error('Context loading not yet implemented - requires base week data');
}

// ============================================
// WEEK ASSIGNMENT GENERATION
// ============================================

async function generateWeekAssignments(
  week: ScheduleWeek,
  context: GenerationContext,
  weekNumber: number
): Promise<void> {
  // Get all assignment slots from base week
  const slots = extractAssignmentSlots(context.baseAssignments, week.start_date);

  // For each slot, assign residents
  for (const slot of slots) {
    await assignResidentsToSlot(week.id, slot, context, weekNumber);
  }
}

function extractAssignmentSlots(
  baseAssignments: ScheduleAssignment[],
  weekStartDate: string
): AssignmentSlot[] {
  const slots: AssignmentSlot[] = [];
  const weekStart = new Date(weekStartDate);

  // Group by role and shift period
  const roleShiftMap = new Map<string, Set<ShiftPeriod>>();

  baseAssignments.forEach((assignment) => {
    const key = assignment.role_id;
    if (!roleShiftMap.has(key)) {
      roleShiftMap.set(key, new Set());
    }
    roleShiftMap.get(key)!.add(assignment.shift_period);
  });

  // Generate slots for each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    roleShiftMap.forEach((shiftPeriods, roleId) => {
      const role = baseAssignments.find((a) => a.role_id === roleId)?.role;
      shiftPeriods.forEach((shiftPeriod) => {
        slots.push({
          roleId,
          roleName: role?.role_name || 'Unknown',
          date: dateStr,
          shiftPeriod,
        });
      });
    });
  }

  return slots;
}

// ============================================
// RESIDENT ASSIGNMENT
// ============================================

async function assignResidentsToSlot(
  weekId: string,
  slot: AssignmentSlot,
  context: GenerationContext,
  weekNumber: number
): Promise<void> {
  // Get eligible residents
  const eligibleResidents = getEligibleResidents(slot, context);

  if (eligibleResidents.length === 0) {
    console.warn(`No eligible residents for ${slot.roleName} ${slot.date} ${slot.shiftPeriod}`);
    return;
  }

  // Score residents
  const scoredResidents = scoreResidents(eligibleResidents, slot, context, weekNumber);

  // Sort by score (lowest first)
  scoredResidents.sort((a, b) => a.score - b.score);

  // Get count from base week (how many residents were assigned)
  const baseAssignment = context.baseAssignments.find(
    (a) => a.role_id === slot.roleId && a.shift_period === slot.shiftPeriod
  );
  const residentCount = baseAssignment?.residents?.filter((r) => !r.is_backup).length || 1;
  const backupCount = baseAssignment?.residents?.filter((r) => r.is_backup).length || 0;

  // Assign top-scored residents
  const assignment = await createScheduleAssignment({
    schedule_week_id: weekId,
    role_id: slot.roleId,
    shift_date: slot.date,
    shift_period: slot.shiftPeriod,
  });

  // Primary residents
  for (let i = 0; i < Math.min(residentCount, scoredResidents.length); i++) {
    await addResidentToAssignment(assignment.id, scoredResidents[i].residentId, false);

    // Check for required pairs
    const pairedResident = findRequiredPair(scoredResidents[i].residentId, context);
    if (pairedResident && !scoredResidents.slice(0, i).some((s) => s.residentId === pairedResident)) {
      await addResidentToAssignment(assignment.id, pairedResident, false);
    }
  }

  // Backup residents
  for (let i = residentCount; i < Math.min(residentCount + backupCount, scoredResidents.length); i++) {
    await addResidentToAssignment(assignment.id, scoredResidents[i].residentId, true);
  }
}

// ============================================
// ELIGIBILITY FILTERING
// ============================================

function getEligibleResidents(
  slot: AssignmentSlot,
  context: GenerationContext
): Profile[] {
  return context.residents.filter((resident) => {
    // Check excluded roles
    if (isRoleExcluded(resident.id, slot.roleId, context)) {
      return false;
    }

    // Check vacation blocks
    if (isOnVacation(resident.id, slot.date, context)) {
      return false;
    }

    // Check ACGME compliance
    if (!meetsACGMERequirements(resident.id, slot, context)) {
      return false;
    }

    return true;
  });
}

function isRoleExcluded(residentId: string, roleId: string, context: GenerationContext): boolean {
  return context.constraints.some(
    (c) =>
      c.resident_id === residentId &&
      c.constraint_type === 'excluded_role' &&
      c.role_id === roleId
  );
}

function isOnVacation(residentId: string, date: string, context: GenerationContext): boolean {
  return context.constraints.some(
    (c) =>
      c.resident_id === residentId &&
      c.constraint_type === 'vacation_block' &&
      c.start_date &&
      c.end_date &&
      date >= c.start_date &&
      date <= c.end_date
  );
}

function meetsACGMERequirements(
  residentId: string,
  slot: AssignmentSlot,
  context: GenerationContext
): boolean {
  const tracking = context.trackingHistory.get(residentId) || [];
  if (tracking.length === 0) return true;

  const recentTracking = tracking[0]; // Most recent week

  // Check hours limit
  if (recentTracking.total_hours >= ACGME_MAX_HOURS_PER_WEEK) {
    return false;
  }

  // Check night shift limit
  if (slot.shiftPeriod === 'night' && recentTracking.night_shifts >= ACGME_MAX_NIGHTS_PER_WEEK) {
    return false;
  }

  // Check every-3rd-night rule (simplified)
  if (slot.shiftPeriod === 'night' && recentTracking.consecutive_nights >= 2) {
    return false;
  }

  return true;
}

// ============================================
// RESIDENT SCORING
// ============================================

function scoreResidents(
  residents: Profile[],
  slot: AssignmentSlot,
  context: GenerationContext,
  weekNumber: number
): ResidentScore[] {
  return residents.map((resident) => {
    const tracking = context.trackingHistory.get(resident.id) || [];
    const recentTracking = tracking[0]; // Most recent week

    const recentHours = recentTracking?.total_hours || 0;
    const recentNights = recentTracking?.night_shifts || 0;
    const consecutiveDays = recentTracking?.consecutive_work_days || 0;
    const daysOffLastWeek = recentTracking?.days_off_count || 1;

    // Calculate fairness score (lower is better)
    let score = 0;

    // Prioritize residents with fewer hours
    score += recentHours * 2;

    // Prioritize residents with fewer night shifts
    if (slot.shiftPeriod === 'night') {
      score += recentNights * 5;
    }

    // Give break to residents with many consecutive days
    score += consecutiveDays * 3;

    // Prioritize residents who didn't get days off
    score -= daysOffLastWeek * 2;

    // Weekend fairness
    const isWeekend = isWeekendDate(slot.date);
    if (isWeekend) {
      const recentWeekendShifts = recentTracking?.weekend_shifts || 0;
      score += recentWeekendShifts * 4;
    }

    return {
      residentId: resident.id,
      score,
      recentHours,
      recentNights,
      consecutiveDays,
      daysOffLastWeek,
    };
  });
}

// ============================================
// PAIRING LOGIC
// ============================================

function findRequiredPair(residentId: string, context: GenerationContext): string | null {
  const pairConstraint = context.constraints.find(
    (c) =>
      c.resident_id === residentId &&
      c.constraint_type === 'required_pair' &&
      c.paired_resident_id
  );

  return pairConstraint?.paired_resident_id || null;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function isWeekendDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
}
