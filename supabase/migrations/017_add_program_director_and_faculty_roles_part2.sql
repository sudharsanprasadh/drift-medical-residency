-- Add program_director and faculty roles - Part 2: Update policies and functions
-- Run this AFTER part 1 has been committed

-- Role privileges mapping:
-- program_director: Same as chief_resident and program_coordinator (program-scoped management)
-- faculty: Same as resident (view-only, program-scoped)

-- ============================================
-- 1. UPDATE APPROVAL REQUEST POLICIES
-- ============================================

-- Program directors can view approval requests from their program (like chiefs/coordinators)
DROP POLICY IF EXISTS "chiefs_view_program_requests" ON approval_requests;

CREATE POLICY "Chiefs and directors view program requests" ON approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles chief
            INNER JOIN profiles applicant ON chief.program_id = applicant.program_id
            WHERE chief.id = auth.uid()
            AND chief.role IN ('chief_resident', 'program_coordinator', 'program_director')
            AND chief.is_approved = true
            AND chief.program_id IS NOT NULL
            AND applicant.id = approval_requests.user_id
            AND applicant.program_id IS NOT NULL
        )
    );

-- Program directors can update approval requests from their program (like chiefs/coordinators)
DROP POLICY IF EXISTS "chiefs_update_program_requests" ON approval_requests;

CREATE POLICY "Chiefs and directors update program requests" ON approval_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles chief
            INNER JOIN profiles applicant ON chief.program_id = applicant.program_id
            WHERE chief.id = auth.uid()
            AND chief.role IN ('chief_resident', 'program_coordinator', 'program_director')
            AND chief.is_approved = true
            AND chief.program_id IS NOT NULL
            AND applicant.id = approval_requests.user_id
            AND applicant.program_id IS NOT NULL
        )
    );

-- Also update the coordinator-specific policies to include program directors
DROP POLICY IF EXISTS "Coordinators view program requests" ON approval_requests;

CREATE POLICY "Coordinators and directors view program requests" ON approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles coordinator
            INNER JOIN profiles applicant ON coordinator.program_id = applicant.program_id
            WHERE coordinator.id = auth.uid()
            AND coordinator.role IN ('program_coordinator', 'program_director')
            AND coordinator.is_approved = true
            AND coordinator.program_id IS NOT NULL
            AND applicant.id = approval_requests.user_id
            AND applicant.program_id IS NOT NULL
        )
    );

DROP POLICY IF EXISTS "Coordinators update program requests" ON approval_requests;

CREATE POLICY "Coordinators and directors update program requests" ON approval_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles coordinator
            INNER JOIN profiles applicant ON coordinator.program_id = applicant.program_id
            WHERE coordinator.id = auth.uid()
            AND coordinator.role IN ('program_coordinator', 'program_director')
            AND coordinator.is_approved = true
            AND coordinator.program_id IS NOT NULL
            AND applicant.id = approval_requests.user_id
            AND applicant.program_id IS NOT NULL
        )
    );

-- Faculty has same view privileges as residents (can view their own requests)
-- No new policy needed - they inherit from "users_view_own_requests"

-- ============================================
-- 2. UPDATE ANNOUNCEMENTS POLICIES
-- ============================================

-- Program directors can create announcements (like chiefs and coordinators)
DROP POLICY IF EXISTS "Chiefs and coordinators can create announcements" ON announcements;

CREATE POLICY "Chiefs, coordinators, and directors can create announcements" ON announcements
    FOR INSERT
    WITH CHECK (
        author_id = auth.uid()
        AND program_id IN (
            SELECT program_id
            FROM profiles
            WHERE id = auth.uid()
            AND is_approved = true
            AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
        )
    );

-- Faculty has same privileges as residents for announcements (view-only)
-- No new policy needed - they inherit from "view_program_announcements"

-- ============================================
-- 3. UPDATE EVENTS POLICIES
-- ============================================

-- Program directors can manage events (like chiefs and coordinators)
DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can create events" ON events;

CREATE POLICY "Chiefs, coordinators, directors, and admins can create events" ON events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'program_coordinator', 'program_director', 'chief_resident')
            AND is_approved = true
        )
    );

DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can update events" ON events;

CREATE POLICY "Chiefs, coordinators, directors, and admins can update events" ON events
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'program_coordinator', 'program_director', 'chief_resident')
            AND is_approved = true
        )
    );

DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can delete events" ON events;

CREATE POLICY "Chiefs, coordinators, directors, and admins can delete events" ON events
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'program_coordinator', 'program_director', 'chief_resident')
            AND is_approved = true
        )
    );

-- Faculty has same privileges as residents for events (view-only)
-- No new policy needed - they inherit from "Users can view events in their program"

-- ============================================
-- 4. UPDATE AUTO-APPROVE FUNCTION
-- ============================================

-- Update the auto-approve function to include program directors
CREATE OR REPLACE FUNCTION auto_approve_first_chief()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a Chief Resident, Program Coordinator, or Program Director completing their profile
    IF NEW.is_profile_complete = true
       AND OLD.is_profile_complete = false
       AND NEW.role IN ('chief_resident', 'program_coordinator', 'program_director')
       AND NEW.program_id IS NOT NULL THEN

        -- Check if there are any other approved Chiefs/Coordinators/Directors/Admins in this program
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE program_id = NEW.program_id
              AND role IN ('chief_resident', 'admin', 'program_coordinator', 'program_director')
              AND is_approved = true
              AND id != NEW.id
        ) THEN
            -- This is the first leadership role in the program - auto-approve
            NEW.is_approved := true;

            RAISE NOTICE 'Auto-approved first leadership role for program %', NEW.program_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_approve_first_chief IS 'Automatically approves the first Chief Resident, Program Coordinator, or Program Director of a program to solve the bootstrapping problem';

-- ============================================
-- 5. ADD COMMENTS FOR CLARITY
-- ============================================

COMMENT ON POLICY "Chiefs and directors view program requests" ON approval_requests IS
'Chief Residents and Program Directors can view approval requests from residents in their program';

COMMENT ON POLICY "Chiefs and directors update program requests" ON approval_requests IS
'Chief Residents and Program Directors can approve/reject residents from their own program';

COMMENT ON POLICY "Coordinators and directors view program requests" ON approval_requests IS
'Program Coordinators and Directors can view approval requests from residents in their program';

COMMENT ON POLICY "Coordinators and directors update program requests" ON approval_requests IS
'Program Coordinators and Directors can approve/reject residents from their own program';

COMMENT ON POLICY "Chiefs, coordinators, and directors can create announcements" ON announcements IS
'Chiefs, Program Coordinators, and Program Directors can post announcements to their program';

COMMENT ON POLICY "Chiefs, coordinators, directors, and admins can create events" ON events IS
'Leadership roles can create events for their program';

COMMENT ON POLICY "Chiefs, coordinators, directors, and admins can update events" ON events IS
'Leadership roles can update events in their program';

COMMENT ON POLICY "Chiefs, coordinators, directors, and admins can delete events" ON events IS
'Leadership roles can delete events from their program';

-- ============================================
-- 6. VERIFICATION QUERIES
-- ============================================

-- Show all roles in the system
SELECT enumlabel as role, enumsortorder
FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;

-- Show all approval_requests policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'approval_requests'
ORDER BY policyname;

-- Show all announcements policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'announcements'
ORDER BY policyname;

-- Show all events policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'events'
ORDER BY policyname;
