-- ============================================
-- SMART ROTATION SYSTEM MIGRATION
-- ============================================
-- This migration adds tables for smart rotation with ACGME compliance:
-- - Rotation constraints (exceptions, pairings, limits)
-- - Hour tracking for compliance
-- - Rotation templates for reusable patterns

-- ============================================
-- ENUMS
-- ============================================

-- Constraint types for rotation rules
CREATE TYPE constraint_type AS ENUM (
    'excluded_role',           -- Resident cannot work specific role
    'required_pair',           -- Resident must work with another resident
    'max_nights_per_month',    -- Limit on night shifts per month
    'preferred_off_day',       -- Preferred day off (e.g., Sundays)
    'vacation_block',          -- Resident on vacation during date range
    'max_consecutive_nights',  -- Max consecutive night shifts
    'min_days_off_per_week'    -- Minimum days off per week
);

-- Rotation algorithm types
CREATE TYPE rotation_algorithm AS ENUM (
    'smart_balanced',    -- Hour-balanced with ACGME compliance
    'round_robin',       -- Simple rotation through roles
    'custom'             -- Custom algorithm (future)
);

-- ============================================
-- SCHEDULE_ROTATION_CONSTRAINTS TABLE
-- ============================================
-- Stores exception rules and constraints for rotation generation
CREATE TABLE schedule_rotation_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_week_id UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,  -- Template week
    resident_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    constraint_type constraint_type NOT NULL,

    -- Constraint-specific fields
    role_id UUID REFERENCES schedule_roles(id) ON DELETE CASCADE,           -- For excluded_role
    paired_resident_id UUID REFERENCES profiles(id) ON DELETE CASCADE,      -- For required_pair
    constraint_value TEXT,                                                   -- Generic value field (JSON or simple value)
    start_date DATE,                                                         -- For vacation_block
    end_date DATE,                                                           -- For vacation_block

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rotation_constraints_week ON schedule_rotation_constraints(schedule_week_id);
CREATE INDEX idx_rotation_constraints_resident ON schedule_rotation_constraints(resident_id);
CREATE INDEX idx_rotation_constraints_type ON schedule_rotation_constraints(constraint_type);

-- ============================================
-- SCHEDULE_ROTATION_TRACKING TABLE
-- ============================================
-- Tracks duty hours and compliance metrics per resident per week
CREATE TABLE schedule_rotation_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    schedule_week_id UUID NOT NULL REFERENCES schedule_weeks(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,

    -- Hour tracking
    total_hours DECIMAL(5,2) DEFAULT 0,                   -- Total hours worked this week
    day_shift_hours DECIMAL(5,2) DEFAULT 0,
    night_shift_hours DECIMAL(5,2) DEFAULT 0,
    max_continuous_hours DECIMAL(5,2) DEFAULT 0,          -- Longest continuous shift

    -- Shift counts
    total_shifts INTEGER DEFAULT 0,
    day_shifts INTEGER DEFAULT 0,
    night_shifts INTEGER DEFAULT 0,
    consecutive_work_days INTEGER DEFAULT 0,
    consecutive_nights INTEGER DEFAULT 0,
    days_off_count INTEGER DEFAULT 0,

    -- Weekend tracking
    weekend_shifts INTEGER DEFAULT 0,

    -- ACGME Compliance flags
    is_compliant BOOLEAN DEFAULT TRUE,
    violation_notes TEXT[],                                -- Array of violation descriptions

    -- Rolling averages (last 4 weeks)
    rolling_4week_hours DECIMAL(6,2) DEFAULT 0,
    rolling_4week_nights INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(resident_id, schedule_week_id)
);

-- Indexes
CREATE INDEX idx_rotation_tracking_resident ON schedule_rotation_tracking(resident_id);
CREATE INDEX idx_rotation_tracking_week ON schedule_rotation_tracking(schedule_week_id);
CREATE INDEX idx_rotation_tracking_dates ON schedule_rotation_tracking(week_start_date, week_end_date);
CREATE INDEX idx_rotation_tracking_compliance ON schedule_rotation_tracking(is_compliant);
CREATE INDEX idx_rotation_tracking_resident_dates ON schedule_rotation_tracking(resident_id, week_start_date);

-- ============================================
-- SCHEDULE_ROTATION_TEMPLATES TABLE
-- ============================================
-- Stores reusable rotation patterns
CREATE TABLE schedule_rotation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    description TEXT,
    base_week_id UUID REFERENCES schedule_weeks(id) ON DELETE SET NULL,   -- Template week
    algorithm rotation_algorithm DEFAULT 'smart_balanced',

    -- Generation settings
    weeks_to_generate INTEGER DEFAULT 52,
    auto_seed_constraints BOOLEAN DEFAULT TRUE,           -- Auto-create common constraints

    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(program_id, template_name)
);

-- Indexes
CREATE INDEX idx_rotation_templates_program ON schedule_rotation_templates(program_id);
CREATE INDEX idx_rotation_templates_active ON schedule_rotation_templates(is_active);

-- ============================================
-- SCHEDULE_GENERATION_JOBS TABLE
-- ============================================
-- Tracks multi-week generation progress
CREATE TABLE schedule_generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES schedule_rotation_templates(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    weeks_to_generate INTEGER NOT NULL,
    weeks_completed INTEGER DEFAULT 0,

    status TEXT DEFAULT 'pending',                         -- pending, running, completed, failed
    error_message TEXT,
    compliance_summary JSONB,                              -- Summary of compliance issues

    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_job_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_generation_jobs_template ON schedule_generation_jobs(template_id);
CREATE INDEX idx_generation_jobs_program ON schedule_generation_jobs(program_id);
CREATE INDEX idx_generation_jobs_status ON schedule_generation_jobs(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE schedule_rotation_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_rotation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_rotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_generation_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CONSTRAINTS POLICIES
-- ============================================

-- Chiefs can manage constraints
CREATE POLICY "Chiefs can manage constraints" ON schedule_rotation_constraints
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM schedule_weeks sw
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sw.id = schedule_rotation_constraints.schedule_week_id
            AND p.id = auth.uid()
            AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p.is_approved = true
        )
    );

-- Residents can view their own constraints
CREATE POLICY "Residents can view own constraints" ON schedule_rotation_constraints
    FOR SELECT USING (
        resident_id = auth.uid()
    );

-- ============================================
-- TRACKING POLICIES
-- ============================================

-- Residents can view their own tracking data
CREATE POLICY "Residents can view own tracking" ON schedule_rotation_tracking
    FOR SELECT USING (
        resident_id = auth.uid()
    );

-- Chiefs can view all tracking for their program
CREATE POLICY "Chiefs can view program tracking" ON schedule_rotation_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM schedule_weeks sw
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sw.id = schedule_rotation_tracking.schedule_week_id
            AND p.id = auth.uid()
            AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p.is_approved = true
        )
    );

-- Chiefs can manage tracking data
CREATE POLICY "Chiefs can manage tracking" ON schedule_rotation_tracking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM schedule_weeks sw
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sw.id = schedule_rotation_tracking.schedule_week_id
            AND p.id = auth.uid()
            AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p.is_approved = true
        )
    );

-- ============================================
-- TEMPLATES POLICIES
-- ============================================

-- Chiefs can manage templates for their program
CREATE POLICY "Chiefs can manage templates" ON schedule_rotation_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_rotation_templates.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    );

-- ============================================
-- JOBS POLICIES
-- ============================================

-- Chiefs can manage generation jobs for their program
CREATE POLICY "Chiefs can manage jobs" ON schedule_generation_jobs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_generation_jobs.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    );

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_rotation_constraints_updated_at BEFORE UPDATE ON schedule_rotation_constraints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rotation_tracking_updated_at BEFORE UPDATE ON schedule_rotation_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rotation_templates_updated_at BEFORE UPDATE ON schedule_rotation_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generation_jobs_updated_at BEFORE UPDATE ON schedule_generation_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate duty hours for a resident in a specific week
CREATE OR REPLACE FUNCTION calculate_resident_duty_hours(
    p_resident_id UUID,
    p_week_id UUID
)
RETURNS TABLE (
    total_hours DECIMAL,
    day_shift_hours DECIMAL,
    night_shift_hours DECIMAL,
    total_shifts INTEGER,
    day_shifts INTEGER,
    night_shifts INTEGER,
    days_off_count INTEGER,
    weekend_shifts INTEGER
) AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
BEGIN
    -- Get week dates
    SELECT start_date, end_date INTO v_week_start, v_week_end
    FROM schedule_weeks WHERE id = p_week_id;

    RETURN QUERY
    SELECT
        -- Assume 12 hours per shift (configurable later)
        COALESCE(COUNT(*) * 12.0, 0)::DECIMAL AS total_hours,
        COALESCE(COUNT(*) FILTER (WHERE sa.shift_period = 'day') * 12.0, 0)::DECIMAL AS day_shift_hours,
        COALESCE(COUNT(*) FILTER (WHERE sa.shift_period = 'night') * 12.0, 0)::DECIMAL AS night_shift_hours,
        COALESCE(COUNT(*)::INTEGER, 0) AS total_shifts,
        COALESCE(COUNT(*) FILTER (WHERE sa.shift_period = 'day')::INTEGER, 0) AS day_shifts,
        COALESCE(COUNT(*) FILTER (WHERE sa.shift_period = 'night')::INTEGER, 0) AS night_shifts,
        (7 - COALESCE(COUNT(DISTINCT sa.shift_date)::INTEGER, 0)) AS days_off_count,
        COALESCE(COUNT(*) FILTER (WHERE EXTRACT(DOW FROM sa.shift_date) IN (0, 6))::INTEGER, 0) AS weekend_shifts
    FROM schedule_assignment_residents sar
    JOIN schedule_assignments sa ON sa.id = sar.assignment_id
    WHERE sar.resident_id = p_resident_id
    AND sar.is_backup = false
    AND sa.schedule_week_id = p_week_id;
END;
$$ LANGUAGE plpgsql;

-- Update tracking data for a resident in a week
CREATE OR REPLACE FUNCTION update_resident_tracking(
    p_resident_id UUID,
    p_week_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
    v_hours RECORD;
    v_violations TEXT[] := ARRAY[]::TEXT[];
    v_is_compliant BOOLEAN := TRUE;
BEGIN
    -- Get week dates
    SELECT start_date, end_date INTO v_week_start, v_week_end
    FROM schedule_weeks WHERE id = p_week_id;

    -- Calculate hours
    SELECT * INTO v_hours FROM calculate_resident_duty_hours(p_resident_id, p_week_id);

    -- Check ACGME compliance
    IF v_hours.total_hours > 80 THEN
        v_violations := array_append(v_violations, 'Exceeds 80 hours per week');
        v_is_compliant := FALSE;
    END IF;

    IF v_hours.days_off_count < 1 THEN
        v_violations := array_append(v_violations, 'Less than 1 day off per week');
        v_is_compliant := FALSE;
    END IF;

    IF v_hours.night_shifts > 4 THEN
        v_violations := array_append(v_violations, 'More than 4 night shifts per week');
        v_is_compliant := FALSE;
    END IF;

    -- Upsert tracking record
    INSERT INTO schedule_rotation_tracking (
        resident_id,
        schedule_week_id,
        week_start_date,
        week_end_date,
        total_hours,
        day_shift_hours,
        night_shift_hours,
        total_shifts,
        day_shifts,
        night_shifts,
        days_off_count,
        weekend_shifts,
        is_compliant,
        violation_notes
    ) VALUES (
        p_resident_id,
        p_week_id,
        v_week_start,
        v_week_end,
        v_hours.total_hours,
        v_hours.day_shift_hours,
        v_hours.night_shift_hours,
        v_hours.total_shifts,
        v_hours.day_shifts,
        v_hours.night_shifts,
        v_hours.days_off_count,
        v_hours.weekend_shifts,
        v_is_compliant,
        v_violations
    )
    ON CONFLICT (resident_id, schedule_week_id)
    DO UPDATE SET
        total_hours = EXCLUDED.total_hours,
        day_shift_hours = EXCLUDED.day_shift_hours,
        night_shift_hours = EXCLUDED.night_shift_hours,
        total_shifts = EXCLUDED.total_shifts,
        day_shifts = EXCLUDED.day_shifts,
        night_shifts = EXCLUDED.night_shifts,
        days_off_count = EXCLUDED.days_off_count,
        weekend_shifts = EXCLUDED.weekend_shifts,
        is_compliant = EXCLUDED.is_compliant,
        violation_notes = EXCLUDED.violation_notes,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Batch update tracking for all residents in a week
CREATE OR REPLACE FUNCTION update_week_tracking(p_week_id UUID)
RETURNS VOID AS $$
DECLARE
    v_resident_id UUID;
BEGIN
    FOR v_resident_id IN
        SELECT DISTINCT sar.resident_id
        FROM schedule_assignment_residents sar
        JOIN schedule_assignments sa ON sa.id = sar.assignment_id
        WHERE sa.schedule_week_id = p_week_id
    LOOP
        PERFORM update_resident_tracking(v_resident_id, p_week_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Get compliance summary for a program
CREATE OR REPLACE FUNCTION get_program_compliance_summary(
    p_program_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_residents INTEGER,
    compliant_residents INTEGER,
    non_compliant_residents INTEGER,
    total_weeks INTEGER,
    compliant_weeks INTEGER,
    compliance_rate DECIMAL,
    common_violations TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT srt.resident_id)::INTEGER AS total_residents,
        COUNT(DISTINCT CASE WHEN srt.is_compliant THEN srt.resident_id END)::INTEGER AS compliant_residents,
        COUNT(DISTINCT CASE WHEN NOT srt.is_compliant THEN srt.resident_id END)::INTEGER AS non_compliant_residents,
        COUNT(DISTINCT srt.schedule_week_id)::INTEGER AS total_weeks,
        COUNT(DISTINCT CASE WHEN srt.is_compliant THEN srt.schedule_week_id END)::INTEGER AS compliant_weeks,
        CASE
            WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE srt.is_compliant)::DECIMAL / COUNT(*)::DECIMAL * 100)
            ELSE 0
        END AS compliance_rate,
        ARRAY_AGG(DISTINCT unnest(srt.violation_notes)) FILTER (WHERE srt.violation_notes IS NOT NULL) AS common_violations
    FROM schedule_rotation_tracking srt
    JOIN schedule_weeks sw ON sw.id = srt.schedule_week_id
    WHERE sw.program_id = p_program_id
    AND (p_start_date IS NULL OR srt.week_start_date >= p_start_date)
    AND (p_end_date IS NULL OR srt.week_end_date <= p_end_date);
END;
$$ LANGUAGE plpgsql;
