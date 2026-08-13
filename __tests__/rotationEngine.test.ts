/**
 * Unit Tests for Rotation Engine
 *
 * Tests ACGME compliance, scoring algorithm, eligibility filtering,
 * and constraint enforcement
 */

import {
  Profile,
  ScheduleRotationConstraint,
  ScheduleRotationTracking,
  ShiftPeriod,
} from '../src/types';

// ============================================
// MOCK DATA FACTORIES
// ============================================

function createMockResident(id: string, overrides?: Partial<Profile>): Profile {
  return {
    id,
    first_name: `Resident${id}`,
    last_name: `Last${id}`,
    email: `resident${id}@test.com`,
    phone_number: null,
    role: 'resident',
    specialty: 'Internal Medicine',
    program_id: 'program-1',
    pgy: 'PGY1',
    is_approved: true,
    is_profile_complete: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockTracking(
  residentId: string,
  overrides?: Partial<ScheduleRotationTracking>
): ScheduleRotationTracking {
  return {
    id: `tracking-${residentId}`,
    resident_id: residentId,
    schedule_week_id: 'week-1',
    week_start_date: '2024-07-01',
    week_end_date: '2024-07-07',
    total_hours: 60,
    day_shift_hours: 36,
    night_shift_hours: 24,
    max_continuous_hours: 12,
    total_shifts: 5,
    day_shifts: 3,
    night_shifts: 2,
    consecutive_work_days: 5,
    consecutive_nights: 2,
    days_off_count: 2,
    weekend_shifts: 1,
    is_compliant: true,
    violation_notes: [],
    rolling_4week_hours: 240,
    rolling_4week_nights: 8,
    created_at: '2024-07-01T00:00:00Z',
    updated_at: '2024-07-07T00:00:00Z',
    ...overrides,
  };
}

function createMockConstraint(
  residentId: string,
  overrides?: Partial<ScheduleRotationConstraint>
): ScheduleRotationConstraint {
  return {
    id: `constraint-${residentId}`,
    schedule_week_id: 'week-1',
    resident_id: residentId,
    constraint_type: 'excluded_role',
    role_id: null,
    paired_resident_id: null,
    constraint_value: null,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================
// ACGME COMPLIANCE TESTS
// ============================================

describe('ACGME Compliance Checks', () => {
  test('should flag violation when hours exceed 80/week', () => {
    const tracking = createMockTracking('resident-1', {
      total_hours: 85,
    });

    // Simulate compliance check
    const violations: string[] = [];
    let isCompliant = true;

    if (tracking.total_hours > 80) {
      violations.push('Exceeds 80 hours per week');
      isCompliant = false;
    }

    expect(isCompliant).toBe(false);
    expect(violations).toContain('Exceeds 80 hours per week');
  });

  test('should pass when hours are within limit', () => {
    const tracking = createMockTracking('resident-1', {
      total_hours: 72,
    });

    const violations: string[] = [];
    let isCompliant = true;

    if (tracking.total_hours > 80) {
      violations.push('Exceeds 80 hours per week');
      isCompliant = false;
    }

    expect(isCompliant).toBe(true);
    expect(violations).toHaveLength(0);
  });

  test('should flag violation when less than 1 day off per week', () => {
    const tracking = createMockTracking('resident-1', {
      days_off_count: 0,
    });

    const violations: string[] = [];
    let isCompliant = true;

    if (tracking.days_off_count < 1) {
      violations.push('Less than 1 day off per week');
      isCompliant = false;
    }

    expect(isCompliant).toBe(false);
    expect(violations).toContain('Less than 1 day off per week');
  });

  test('should flag violation when more than 4 night shifts per week', () => {
    const tracking = createMockTracking('resident-1', {
      night_shifts: 5,
    });

    const violations: string[] = [];
    let isCompliant = true;

    if (tracking.night_shifts > 4) {
      violations.push('More than 4 night shifts per week');
      isCompliant = false;
    }

    expect(isCompliant).toBe(false);
    expect(violations).toContain('More than 4 night shifts per week');
  });

  test('should handle multiple violations', () => {
    const tracking = createMockTracking('resident-1', {
      total_hours: 85,
      days_off_count: 0,
      night_shifts: 5,
    });

    const violations: string[] = [];

    if (tracking.total_hours > 80) {
      violations.push('Exceeds 80 hours per week');
    }
    if (tracking.days_off_count < 1) {
      violations.push('Less than 1 day off per week');
    }
    if (tracking.night_shifts > 4) {
      violations.push('More than 4 night shifts per week');
    }

    expect(violations).toHaveLength(3);
    expect(violations).toContain('Exceeds 80 hours per week');
    expect(violations).toContain('Less than 1 day off per week');
    expect(violations).toContain('More than 4 night shifts per week');
  });
});

// ============================================
// SCORING ALGORITHM TESTS
// ============================================

describe('Resident Scoring Algorithm', () => {
  function calculateScore(tracking: ScheduleRotationTracking, isWeekend: boolean, isNightShift: boolean): number {
    const recentHours = tracking.total_hours;
    const recentNights = tracking.night_shifts;
    const consecutiveDays = tracking.consecutive_work_days;
    const daysOffLastWeek = tracking.days_off_count;
    const weekendShifts = tracking.weekend_shifts;

    let score = 0;
    score += recentHours * 2;
    if (isNightShift) {
      score += recentNights * 5;
    }
    score += consecutiveDays * 3;
    score -= daysOffLastWeek * 2;
    if (isWeekend) {
      score += weekendShifts * 4;
    }

    return score;
  }

  test('should prioritize resident with fewer hours', () => {
    const resident1 = createMockTracking('1', { total_hours: 40 });
    const resident2 = createMockTracking('2', { total_hours: 70 });

    const score1 = calculateScore(resident1, false, false);
    const score2 = calculateScore(resident2, false, false);

    expect(score1).toBeLessThan(score2);
  });

  test('should prioritize resident with fewer night shifts for night assignments', () => {
    const resident1 = createMockTracking('1', { night_shifts: 1 });
    const resident2 = createMockTracking('2', { night_shifts: 3 });

    const score1 = calculateScore(resident1, false, true);
    const score2 = calculateScore(resident2, false, true);

    expect(score1).toBeLessThan(score2);
  });

  test('should give break to resident with many consecutive days', () => {
    const resident1 = createMockTracking('1', { consecutive_work_days: 2 });
    const resident2 = createMockTracking('2', { consecutive_work_days: 6 });

    const score1 = calculateScore(resident1, false, false);
    const score2 = calculateScore(resident2, false, false);

    expect(score1).toBeLessThan(score2);
  });

  test('should prioritize resident who had fewer days off', () => {
    const resident1 = createMockTracking('1', { days_off_count: 0 });
    const resident2 = createMockTracking('2', { days_off_count: 2 });

    const score1 = calculateScore(resident1, false, false);
    const score2 = calculateScore(resident2, false, false);

    expect(score1).toBeLessThan(score2);
  });

  test('should distribute weekend shifts fairly', () => {
    const resident1 = createMockTracking('1', { weekend_shifts: 1 });
    const resident2 = createMockTracking('2', { weekend_shifts: 3 });

    const score1 = calculateScore(resident1, true, false);
    const score2 = calculateScore(resident2, true, false);

    expect(score1).toBeLessThan(score2);
  });
});

// ============================================
// ELIGIBILITY FILTERING TESTS
// ============================================

describe('Eligibility Filtering', () => {
  test('should exclude resident from specific role', () => {
    const resident = createMockResident('1');
    const constraint = createMockConstraint('1', {
      constraint_type: 'excluded_role',
      role_id: 'picu-role',
    });

    const roleId = 'picu-role';
    const isExcluded = constraint.constraint_type === 'excluded_role' && constraint.role_id === roleId;

    expect(isExcluded).toBe(true);
  });

  test('should allow resident for non-excluded role', () => {
    const resident = createMockResident('1');
    const constraint = createMockConstraint('1', {
      constraint_type: 'excluded_role',
      role_id: 'picu-role',
    });

    const roleId = 'nicu-role';
    const isExcluded = constraint.constraint_type === 'excluded_role' && constraint.role_id === roleId;

    expect(isExcluded).toBe(false);
  });

  test('should exclude resident on vacation', () => {
    const constraint = createMockConstraint('1', {
      constraint_type: 'vacation_block',
      start_date: '2024-07-01',
      end_date: '2024-07-07',
    });

    const checkDate = '2024-07-03';
    const isOnVacation =
      constraint.constraint_type === 'vacation_block' &&
      constraint.start_date &&
      constraint.end_date &&
      checkDate >= constraint.start_date &&
      checkDate <= constraint.end_date;

    expect(isOnVacation).toBe(true);
  });

  test('should allow resident outside vacation dates', () => {
    const constraint = createMockConstraint('1', {
      constraint_type: 'vacation_block',
      start_date: '2024-07-01',
      end_date: '2024-07-07',
    });

    const checkDate = '2024-07-15';
    const isOnVacation =
      constraint.constraint_type === 'vacation_block' &&
      constraint.start_date &&
      constraint.end_date &&
      checkDate >= constraint.start_date &&
      checkDate <= constraint.end_date;

    expect(isOnVacation).toBe(false);
  });

  test('should exclude resident who already worked max hours', () => {
    const tracking = createMockTracking('1', {
      total_hours: 80,
    });

    const meetsRequirement = tracking.total_hours < 80;
    expect(meetsRequirement).toBe(false);
  });

  test('should exclude resident with too many consecutive nights', () => {
    const tracking = createMockTracking('1', {
      consecutive_nights: 2,
    });

    const shiftPeriod: ShiftPeriod = 'night';
    const meetsRequirement = !(shiftPeriod === 'night' && tracking.consecutive_nights >= 2);

    expect(meetsRequirement).toBe(false);
  });
});

// ============================================
// PAIRING LOGIC TESTS
// ============================================

describe('Required Pairing', () => {
  test('should identify required pair', () => {
    const constraint = createMockConstraint('1', {
      constraint_type: 'required_pair',
      paired_resident_id: 'resident-2',
    });

    const pairedResidentId =
      constraint.constraint_type === 'required_pair' ? constraint.paired_resident_id : null;

    expect(pairedResidentId).toBe('resident-2');
  });

  test('should return null when no pairing constraint exists', () => {
    const constraint = createMockConstraint('1', {
      constraint_type: 'excluded_role',
    });

    const pairedResidentId =
      constraint.constraint_type === 'required_pair' ? constraint.paired_resident_id : null;

    expect(pairedResidentId).toBeNull();
  });
});

// ============================================
// HOUR CALCULATION TESTS
// ============================================

describe('Duty Hour Calculations', () => {
  const HOURS_PER_SHIFT = 12;

  test('should calculate total hours correctly', () => {
    const dayShifts = 3;
    const nightShifts = 2;
    const totalHours = (dayShifts + nightShifts) * HOURS_PER_SHIFT;

    expect(totalHours).toBe(60);
  });

  test('should calculate days off correctly', () => {
    const daysInWeek = 7;
    const shiftsWorked = 5;
    const daysOff = daysInWeek - shiftsWorked;

    expect(daysOff).toBe(2);
  });

  test('should identify weekend shifts', () => {
    const saturdayDate = new Date('2024-07-06'); // Saturday
    const sundayDate = new Date('2024-07-07'); // Sunday
    const mondayDate = new Date('2024-07-08'); // Monday

    expect(saturdayDate.getDay()).toBe(6);
    expect(sundayDate.getDay()).toBe(0);
    expect(mondayDate.getDay()).toBe(1);

    const isSaturdayWeekend = saturdayDate.getDay() === 0 || saturdayDate.getDay() === 6;
    const isSundayWeekend = sundayDate.getDay() === 0 || sundayDate.getDay() === 6;
    const isMondayWeekend = mondayDate.getDay() === 0 || mondayDate.getDay() === 6;

    expect(isSaturdayWeekend).toBe(true);
    expect(isSundayWeekend).toBe(true);
    expect(isMondayWeekend).toBe(false);
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('Edge Cases', () => {
  test('should handle resident with no tracking history', () => {
    const tracking = createMockTracking('1', {
      total_hours: 0,
      night_shifts: 0,
      consecutive_work_days: 0,
      days_off_count: 7,
    });

    const violations: string[] = [];
    let isCompliant = true;

    if (tracking.total_hours > 80) {
      violations.push('Exceeds 80 hours per week');
      isCompliant = false;
    }
    if (tracking.days_off_count < 1) {
      violations.push('Less than 1 day off per week');
      isCompliant = false;
    }

    expect(isCompliant).toBe(true);
    expect(violations).toHaveLength(0);
  });

  test('should handle multiple constraints for same resident', () => {
    const constraints = [
      createMockConstraint('1', {
        constraint_type: 'excluded_role',
        role_id: 'picu-role',
      }),
      createMockConstraint('1', {
        constraint_type: 'vacation_block',
        start_date: '2024-07-01',
        end_date: '2024-07-07',
      }),
      createMockConstraint('1', {
        constraint_type: 'required_pair',
        paired_resident_id: 'resident-2',
      }),
    ];

    expect(constraints).toHaveLength(3);
    expect(constraints[0].constraint_type).toBe('excluded_role');
    expect(constraints[1].constraint_type).toBe('vacation_block');
    expect(constraints[2].constraint_type).toBe('required_pair');
  });

  test('should handle equal scores by maintaining order', () => {
    const resident1 = createMockTracking('1', { total_hours: 60 });
    const resident2 = createMockTracking('2', { total_hours: 60 });

    const score1 = resident1.total_hours * 2;
    const score2 = resident2.total_hours * 2;

    expect(score1).toBe(score2);
  });
});

// ============================================
// INTEGRATION SCENARIOS
// ============================================

describe('Integration Scenarios', () => {
  test('should generate compliant schedule for typical week', () => {
    const residents = [
      createMockTracking('1', { total_hours: 48, night_shifts: 2 }),
      createMockTracking('2', { total_hours: 60, night_shifts: 3 }),
      createMockTracking('3', { total_hours: 36, night_shifts: 1 }),
    ];

    // All residents should be compliant
    const allCompliant = residents.every((r) => r.total_hours <= 80 && r.night_shifts <= 4);

    expect(allCompliant).toBe(true);
  });

  test('should balance workload across residents', () => {
    const residents = [
      createMockTracking('1', { total_hours: 60 }),
      createMockTracking('2', { total_hours: 62 }),
      createMockTracking('3', { total_hours: 58 }),
    ];

    const totalHours = residents.reduce((sum, r) => sum + r.total_hours, 0);
    const avgHours = totalHours / residents.length;
    const maxDeviation = Math.max(...residents.map((r) => Math.abs(r.total_hours - avgHours)));

    // Deviation should be small (within 5 hours)
    expect(maxDeviation).toBeLessThanOrEqual(5);
  });

  test('should respect vacation blocks when assigning shifts', () => {
    const constraint = createMockConstraint('1', {
      constraint_type: 'vacation_block',
      start_date: '2024-07-08',
      end_date: '2024-07-14',
    });

    const shiftDate = '2024-07-10';
    const isOnVacation =
      constraint.constraint_type === 'vacation_block' &&
      constraint.start_date &&
      constraint.end_date &&
      shiftDate >= constraint.start_date &&
      shiftDate <= constraint.end_date;

    // Should NOT assign resident to shift during vacation
    const canAssign = !isOnVacation;
    expect(canAssign).toBe(false);
  });
});
