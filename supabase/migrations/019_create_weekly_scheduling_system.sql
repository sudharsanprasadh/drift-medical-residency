-- ============================================
-- WEEKLY SCHEDULING SYSTEM MIGRATION
-- ============================================
-- This migration creates tables for weekly resident scheduling
-- with role-based assignments, day/night shifts, backup coverage,
-- multi-resident assignments, and ACGME-compliant rotation support

-- ============================================
-- ENUMS
-- ============================================

-- Shift periods
CREATE TYPE shift_period AS ENUM (
    'day',            -- Day shift
    'night',          -- Night shift
    'day_night'       -- Combined (e.g., holidays)
);

-- Schedule status
CREATE TYPE schedule_status AS ENUM (
    'draft',          -- Being created
    'published',      -- Active and visible to residents
    'archived'        -- Past schedule
);

-- ============================================
-- SCHEDULE_WEEKS TABLE
-- ============================================
-- Represents a weekly schedule period with flexible start/end dates
CREATE TABLE schedule_weeks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    week_name TEXT NOT NULL,                    -- e.g., "Week 1", "July 1-7, 2024"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status schedule_status DEFAULT 'draft',
    notes TEXT,                                 -- General notes for the week
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure dates are valid
    CONSTRAINT valid_week_dates CHECK (end_date >= start_date)
);

-- Indexes
CREATE INDEX idx_schedule_weeks_program ON schedule_weeks(program_id);
CREATE INDEX idx_schedule_weeks_dates ON schedule_weeks(start_date, end_date);
CREATE INDEX idx_schedule_weeks_status ON schedule_weeks(status);
CREATE INDEX idx_schedule_weeks_program_status ON schedule_weeks(program_id, status);

-- ============================================
-- SCHEDULE_ROLES TABLE
-- ============================================
-- Configurable roles (PICU, NICU, A5 Senior, etc.) per program
CREATE TABLE schedule_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,                    -- e.g., "PICU", "NICU", "A5 Senior"
    display_order INTEGER DEFAULT 0,            -- Order in UI
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(program_id, role_name)
);

-- Indexes
CREATE INDEX idx_schedule_roles_program ON schedule_roles(program_id);
CREATE INDEX idx_schedule_roles_active ON schedule_roles(is_active);
CREATE INDEX idx_schedule_roles_program_active ON schedule_roles(program_id, is_active);

-- ============================================
-- SCHEDULE_ASSIGNMENTS TABLE
-- ============================================
-- Daily shift assignments for each role
CREATE TABLE schedule_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_week_id UUID NOT NULL REFERENCES schedule_weeks(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES schedule_roles(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_period shift_period NOT NULL,         -- day, night, or day_night
    notes TEXT,                                  -- Shift-specific notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assignments_week ON schedule_assignments(schedule_week_id);
CREATE INDEX idx_assignments_role ON schedule_assignments(role_id);
CREATE INDEX idx_assignments_date ON schedule_assignments(shift_date);
CREATE INDEX idx_assignments_week_date ON schedule_assignments(schedule_week_id, shift_date);
CREATE INDEX idx_assignments_week_role_date ON schedule_assignments(schedule_week_id, role_id, shift_date);

-- ============================================
-- SCHEDULE_ASSIGNMENT_RESIDENTS TABLE
-- ============================================
-- Junction table: Multiple residents can be assigned to one shift
CREATE TABLE schedule_assignment_residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES schedule_assignments(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_backup BOOLEAN DEFAULT FALSE,            -- TRUE if backup coverage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate resident assignments to same shift
    UNIQUE(assignment_id, resident_id)
);

-- Indexes
CREATE INDEX idx_assignment_residents_assignment ON schedule_assignment_residents(assignment_id);
CREATE INDEX idx_assignment_residents_resident ON schedule_assignment_residents(resident_id);
CREATE INDEX idx_assignment_residents_backup ON schedule_assignment_residents(is_backup);
CREATE INDEX idx_assignment_residents_resident_backup ON schedule_assignment_residents(resident_id, is_backup);

-- ============================================
-- SHIFT_SWAP_REQUESTS TABLE
-- ============================================
-- Two-step swap workflow: Requester → Target accepts → Chief approves
CREATE TABLE shift_swap_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    requester_assignment_id UUID NOT NULL REFERENCES schedule_assignment_residents(id) ON DELETE CASCADE,
    target_resident_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_assignment_id UUID REFERENCES schedule_assignment_residents(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending_target',       -- pending_target, pending_chief, approved, rejected, cancelled
    reason TEXT,
    target_response TEXT,                       -- Target's acceptance/rejection message
    target_responded_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_swap_status CHECK (status IN ('pending_target', 'pending_chief', 'approved', 'rejected', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_swap_requester ON shift_swap_requests(requester_id);
CREATE INDEX idx_swap_target ON shift_swap_requests(target_resident_id);
CREATE INDEX idx_swap_status ON shift_swap_requests(status);
CREATE INDEX idx_swap_requester_status ON shift_swap_requests(requester_id, status);
CREATE INDEX idx_swap_target_status ON shift_swap_requests(target_resident_id, status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE schedule_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignment_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SCHEDULE_WEEKS POLICIES
-- ============================================

-- Residents can view published schedules for their program
CREATE POLICY "Residents can view published schedules" ON schedule_weeks
    FOR SELECT USING (
        status = 'published'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_weeks.program_id
            AND is_approved = true
        )
    );

-- Chiefs/coordinators/directors can view all schedules in their program
CREATE POLICY "Chiefs can view all program schedules" ON schedule_weeks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_weeks.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    );

-- Chiefs/coordinators/directors can create schedules
CREATE POLICY "Chiefs can create schedules" ON schedule_weeks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_weeks.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    );

-- Chiefs/coordinators/directors can update their program's schedules
CREATE POLICY "Chiefs can update schedules" ON schedule_weeks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_weeks.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_weeks.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    );

-- Chiefs/coordinators/directors can delete their program's schedules
CREATE POLICY "Chiefs can delete schedules" ON schedule_weeks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_weeks.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    );

-- ============================================
-- SCHEDULE_ROLES POLICIES
-- ============================================

-- All program members can view active roles
CREATE POLICY "Program members can view roles" ON schedule_roles
    FOR SELECT USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_roles.program_id
            AND is_approved = true
        )
    );

-- Chiefs/coordinators/directors can manage roles
CREATE POLICY "Chiefs can manage roles" ON schedule_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = schedule_roles.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND is_approved = true
        )
    );

-- ============================================
-- SCHEDULE_ASSIGNMENTS POLICIES
-- ============================================

-- Residents can view assignments for published schedules in their program
CREATE POLICY "Residents can view published assignments" ON schedule_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM schedule_weeks sw
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sw.id = schedule_assignments.schedule_week_id
            AND sw.status = 'published'
            AND p.id = auth.uid()
            AND p.is_approved = true
        )
    );

-- Chiefs/coordinators/directors can view all assignments
CREATE POLICY "Chiefs can view all assignments" ON schedule_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM schedule_weeks sw
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sw.id = schedule_assignments.schedule_week_id
            AND p.id = auth.uid()
            AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p.is_approved = true
        )
    );

-- Chiefs/coordinators/directors can manage assignments
CREATE POLICY "Chiefs can manage assignments" ON schedule_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM schedule_weeks sw
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sw.id = schedule_assignments.schedule_week_id
            AND p.id = auth.uid()
            AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p.is_approved = true
        )
    );

-- ============================================
-- SCHEDULE_ASSIGNMENT_RESIDENTS POLICIES
-- ============================================

-- Residents can view their own assignments
CREATE POLICY "Residents can view own assignments" ON schedule_assignment_residents
    FOR SELECT USING (
        resident_id = auth.uid()
    );

-- Residents can view assignments for published schedules in their program
CREATE POLICY "Residents can view published assignment residents" ON schedule_assignment_residents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM schedule_assignments sa
            JOIN schedule_weeks sw ON sw.id = sa.schedule_week_id
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sa.id = schedule_assignment_residents.assignment_id
            AND sw.status = 'published'
            AND p.id = auth.uid()
            AND p.is_approved = true
        )
    );

-- Chiefs/coordinators/directors can manage assignment residents
CREATE POLICY "Chiefs can manage assignment residents" ON schedule_assignment_residents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM schedule_assignments sa
            JOIN schedule_weeks sw ON sw.id = sa.schedule_week_id
            JOIN profiles p ON p.program_id = sw.program_id
            WHERE sa.id = schedule_assignment_residents.assignment_id
            AND p.id = auth.uid()
            AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p.is_approved = true
        )
    );

-- ============================================
-- SHIFT_SWAP_REQUESTS POLICIES
-- ============================================

-- Residents can view their own swap requests (as requester or target)
CREATE POLICY "Residents can view own swap requests" ON shift_swap_requests
    FOR SELECT USING (
        auth.uid() = requester_id OR auth.uid() = target_resident_id
    );

-- Chiefs/coordinators/directors can view all swap requests in their program
CREATE POLICY "Chiefs can view program swap requests" ON shift_swap_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p1
            JOIN profiles p2 ON p1.program_id = p2.program_id
            WHERE p1.id = auth.uid()
            AND p2.id = shift_swap_requests.requester_id
            AND p1.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p1.is_approved = true
        )
    );

-- Residents can create swap requests
CREATE POLICY "Residents can create swap requests" ON shift_swap_requests
    FOR INSERT WITH CHECK (
        auth.uid() = requester_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND is_approved = true
        )
    );

-- Target residents can respond to swap requests
CREATE POLICY "Target can update swap requests" ON shift_swap_requests
    FOR UPDATE USING (
        auth.uid() = target_resident_id
        AND status = 'pending_target'
    ) WITH CHECK (
        auth.uid() = target_resident_id
    );

-- Chiefs/coordinators/directors can approve/reject swap requests
CREATE POLICY "Chiefs can manage swap requests" ON shift_swap_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p1
            JOIN profiles p2 ON p1.program_id = p2.program_id
            WHERE p1.id = auth.uid()
            AND p2.id = shift_swap_requests.requester_id
            AND p1.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p1.is_approved = true
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p1
            JOIN profiles p2 ON p1.program_id = p2.program_id
            WHERE p1.id = auth.uid()
            AND p2.id = shift_swap_requests.requester_id
            AND p1.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND p1.is_approved = true
        )
    );

-- Requesters can cancel their own pending requests
CREATE POLICY "Requesters can cancel own requests" ON shift_swap_requests
    FOR UPDATE USING (
        auth.uid() = requester_id
        AND status IN ('pending_target', 'pending_chief')
    ) WITH CHECK (
        auth.uid() = requester_id
        AND status = 'cancelled'
    );

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_schedule_weeks_updated_at BEFORE UPDATE ON schedule_weeks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_roles_updated_at BEFORE UPDATE ON schedule_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_assignments_updated_at BEFORE UPDATE ON schedule_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swap_requests_updated_at BEFORE UPDATE ON shift_swap_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get resident's schedule for a date range
CREATE OR REPLACE FUNCTION get_resident_weekly_schedule(
    p_resident_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    week_id UUID,
    week_name TEXT,
    shift_date DATE,
    role_name TEXT,
    shift_period shift_period,
    is_backup BOOLEAN,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sw.id,
        sw.week_name,
        sa.shift_date,
        sr.role_name,
        sa.shift_period,
        sar.is_backup,
        sa.notes
    FROM schedule_assignment_residents sar
    JOIN schedule_assignments sa ON sa.id = sar.assignment_id
    JOIN schedule_weeks sw ON sw.id = sa.schedule_week_id
    JOIN schedule_roles sr ON sr.id = sa.role_id
    WHERE sar.resident_id = p_resident_id
    AND sa.shift_date BETWEEN p_start_date AND p_end_date
    AND sw.status = 'published'
    ORDER BY sa.shift_date, sr.display_order;
END;
$$ LANGUAGE plpgsql;

-- Seed default schedule roles for a program
CREATE OR REPLACE FUNCTION seed_default_schedule_roles(p_program_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO schedule_roles (program_id, role_name, display_order) VALUES
        (p_program_id, 'PICU', 1),
        (p_program_id, 'NICU', 2),
        (p_program_id, 'Nursery', 3),
        (p_program_id, 'A5 Senior', 4),
        (p_program_id, 'H/O Senior', 5),
        (p_program_id, 'A5 Intern', 6),
        (p_program_id, 'H/O Intern', 7),
        (p_program_id, 'SB Senior', 8),
        (p_program_id, 'SB Intern', 9),
        (p_program_id, 'Back-Up Senior', 10),
        (p_program_id, 'Back-Up Intern', 11)
    ON CONFLICT (program_id, role_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Get schedule grid for a week (for UI display)
CREATE OR REPLACE FUNCTION get_schedule_week_grid(p_week_id UUID)
RETURNS TABLE (
    shift_date DATE,
    role_id UUID,
    role_name TEXT,
    day_residents TEXT[],
    day_backup_residents TEXT[],
    night_residents TEXT[],
    night_backup_residents TEXT[],
    day_night_residents TEXT[],
    day_night_backup_residents TEXT[],
    day_notes TEXT,
    night_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH date_range AS (
        SELECT generate_series(
            (SELECT start_date FROM schedule_weeks WHERE id = p_week_id),
            (SELECT end_date FROM schedule_weeks WHERE id = p_week_id),
            '1 day'::interval
        )::date AS shift_date
    ),
    roles AS (
        SELECT sr.id, sr.role_name, sr.display_order
        FROM schedule_roles sr
        JOIN schedule_weeks sw ON sw.program_id = sr.program_id
        WHERE sw.id = p_week_id AND sr.is_active = true
    )
    SELECT
        dr.shift_date,
        r.id AS role_id,
        r.role_name,
        -- Day shift primary residents
        COALESCE(ARRAY_AGG(DISTINCT p_day.first_name || ' ' || p_day.last_name) FILTER (WHERE sa_day.shift_period = 'day' AND sar_day.is_backup = false), ARRAY[]::TEXT[]) AS day_residents,
        -- Day shift backup residents
        COALESCE(ARRAY_AGG(DISTINCT p_day_backup.first_name || ' ' || p_day_backup.last_name) FILTER (WHERE sa_day.shift_period = 'day' AND sar_day.is_backup = true), ARRAY[]::TEXT[]) AS day_backup_residents,
        -- Night shift primary residents
        COALESCE(ARRAY_AGG(DISTINCT p_night.first_name || ' ' || p_night.last_name) FILTER (WHERE sa_night.shift_period = 'night' AND sar_night.is_backup = false), ARRAY[]::TEXT[]) AS night_residents,
        -- Night shift backup residents
        COALESCE(ARRAY_AGG(DISTINCT p_night_backup.first_name || ' ' || p_night_backup.last_name) FILTER (WHERE sa_night.shift_period = 'night' AND sar_night.is_backup = true), ARRAY[]::TEXT[]) AS night_backup_residents,
        -- Day/Night shift primary residents
        COALESCE(ARRAY_AGG(DISTINCT p_dn.first_name || ' ' || p_dn.last_name) FILTER (WHERE sa_dn.shift_period = 'day_night' AND sar_dn.is_backup = false), ARRAY[]::TEXT[]) AS day_night_residents,
        -- Day/Night shift backup residents
        COALESCE(ARRAY_AGG(DISTINCT p_dn_backup.first_name || ' ' || p_dn_backup.last_name) FILTER (WHERE sa_dn.shift_period = 'day_night' AND sar_dn.is_backup = true), ARRAY[]::TEXT[]) AS day_night_backup_residents,
        MAX(sa_day.notes) AS day_notes,
        MAX(sa_night.notes) AS night_notes
    FROM date_range dr
    CROSS JOIN roles r
    -- Day shift
    LEFT JOIN schedule_assignments sa_day ON sa_day.schedule_week_id = p_week_id AND sa_day.role_id = r.id AND sa_day.shift_date = dr.shift_date AND sa_day.shift_period = 'day'
    LEFT JOIN schedule_assignment_residents sar_day ON sar_day.assignment_id = sa_day.id
    LEFT JOIN profiles p_day ON p_day.id = sar_day.resident_id AND sar_day.is_backup = false
    LEFT JOIN profiles p_day_backup ON p_day_backup.id = sar_day.resident_id AND sar_day.is_backup = true
    -- Night shift
    LEFT JOIN schedule_assignments sa_night ON sa_night.schedule_week_id = p_week_id AND sa_night.role_id = r.id AND sa_night.shift_date = dr.shift_date AND sa_night.shift_period = 'night'
    LEFT JOIN schedule_assignment_residents sar_night ON sar_night.assignment_id = sa_night.id
    LEFT JOIN profiles p_night ON p_night.id = sar_night.resident_id AND sar_night.is_backup = false
    LEFT JOIN profiles p_night_backup ON p_night_backup.id = sar_night.resident_id AND sar_night.is_backup = true
    -- Day/Night shift
    LEFT JOIN schedule_assignments sa_dn ON sa_dn.schedule_week_id = p_week_id AND sa_dn.role_id = r.id AND sa_dn.shift_date = dr.shift_date AND sa_dn.shift_period = 'day_night'
    LEFT JOIN schedule_assignment_residents sar_dn ON sar_dn.assignment_id = sa_dn.id
    LEFT JOIN profiles p_dn ON p_dn.id = sar_dn.resident_id AND sar_dn.is_backup = false
    LEFT JOIN profiles p_dn_backup ON p_dn_backup.id = sar_dn.resident_id AND sar_dn.is_backup = true
    GROUP BY dr.shift_date, r.id, r.role_name, r.display_order
    ORDER BY dr.shift_date, r.display_order;
END;
$$ LANGUAGE plpgsql;
