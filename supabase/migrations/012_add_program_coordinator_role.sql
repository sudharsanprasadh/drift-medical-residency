-- Add program_coordinator role with admin privileges
-- Program coordinators have the same permissions as admins

-- ============================================
-- 1. ADD PROGRAM_COORDINATOR TO user_role ENUM
-- ============================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'program_coordinator';

-- ============================================
-- 2. UPDATE RLS POLICIES TO INCLUDE PROGRAM_COORDINATOR
-- ============================================

-- Approval Requests: Program coordinators can view all approval requests (like admins)
DROP POLICY IF EXISTS "Admins can view all approval requests" ON approval_requests;

CREATE POLICY "Admins and coordinators can view all approval requests" ON approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'program_coordinator')
            AND is_approved = true
        )
    );

-- Approval Requests: Program coordinators can update approval requests (like admins)
DROP POLICY IF EXISTS "Admins can update approval requests" ON approval_requests;

CREATE POLICY "Admins and coordinators can update approval requests" ON approval_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'program_coordinator')
            AND is_approved = true
        )
    );

-- ============================================
-- 3. UPDATE ANNOUNCEMENTS POLICIES
-- ============================================

-- Program coordinators can create announcements (like chiefs and admins)
DROP POLICY IF EXISTS "Chiefs and admins can create announcements" ON announcements;

CREATE POLICY "Chiefs, coordinators, and admins can create announcements" ON announcements
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('chief_resident', 'admin', 'program_coordinator')
            AND is_approved = true
        )
    );

-- Program coordinators can delete announcements (like admins)
DROP POLICY IF EXISTS "Admins can delete any announcement" ON announcements;

CREATE POLICY "Admins and coordinators can delete any announcement" ON announcements
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'program_coordinator')
            AND is_approved = true
        )
    );

-- ============================================
-- 4. UPDATE AUTO-APPROVE FUNCTION
-- ============================================

-- Update the auto-approve function to also check for program coordinators
CREATE OR REPLACE FUNCTION auto_approve_first_chief()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a Chief Resident or Program Coordinator completing their profile
    IF NEW.is_profile_complete = true
       AND OLD.is_profile_complete = false
       AND NEW.role IN ('chief_resident', 'program_coordinator')
       AND NEW.program_id IS NOT NULL THEN

        -- Check if there are any other approved Chiefs/Coordinators/Admins in this program
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE program_id = NEW.program_id
              AND role IN ('chief_resident', 'admin', 'program_coordinator')
              AND is_approved = true
              AND id != NEW.id
        ) THEN
            -- This is the first Chief/Coordinator/Admin in the program - auto-approve
            NEW.is_approved := true;

            RAISE NOTICE 'Auto-approved first Chief/Coordinator for program %', NEW.program_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update comment
COMMENT ON FUNCTION auto_approve_first_chief IS 'Automatically approves the first Chief Resident or Program Coordinator of a program to solve the bootstrapping problem';

-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

-- List all role enum values
DO $$
BEGIN
    RAISE NOTICE 'Available user roles: %', (
        SELECT array_agg(enumlabel::text ORDER BY enumsortorder)
        FROM pg_enum
        WHERE enumtypid = 'user_role'::regtype
    );
END $$;

-- Show updated RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('approval_requests', 'announcements')
AND policyname LIKE '%coordinat%'
ORDER BY tablename, policyname;
