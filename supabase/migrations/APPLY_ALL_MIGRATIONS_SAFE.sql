-- ============================================
-- SAFE COMBINED MIGRATIONS: Drop all first, then recreate
-- Migrations 016, 017, and 018
-- ============================================

-- This version is safe to run multiple times
-- It drops ALL existing policies first, then recreates them

-- ============================================
-- STEP 1: Add new role enum values (safe to run multiple times)
-- ============================================

DO $$
BEGIN
    -- Add program_director role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'program_director'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'program_director';
        RAISE NOTICE 'Added program_director to user_role enum';
    ELSE
        RAISE NOTICE 'program_director already exists in user_role enum';
    END IF;

    -- Add faculty role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'faculty'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'faculty';
        RAISE NOTICE 'Added faculty to user_role enum';
    ELSE
        RAISE NOTICE 'faculty already exists in user_role enum';
    END IF;
END $$;

-- ============================================
-- STEP 2: Drop ALL existing policies on approval_requests
-- ============================================

DROP POLICY IF EXISTS "users_view_own_requests" ON approval_requests;
DROP POLICY IF EXISTS "chiefs_view_program_requests" ON approval_requests;
DROP POLICY IF EXISTS "admins_view_all_requests" ON approval_requests;
DROP POLICY IF EXISTS "chiefs_update_program_requests" ON approval_requests;
DROP POLICY IF EXISTS "admins_update_all_requests" ON approval_requests;
DROP POLICY IF EXISTS "system_insert_requests" ON approval_requests;
DROP POLICY IF EXISTS "Admins can view all approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Admins can update approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Admins and coordinators can view all approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Admins and coordinators can update approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Coordinators view program requests" ON approval_requests;
DROP POLICY IF EXISTS "Coordinators update program requests" ON approval_requests;
DROP POLICY IF EXISTS "Chiefs and directors view program requests" ON approval_requests;
DROP POLICY IF EXISTS "Chiefs and directors update program requests" ON approval_requests;
DROP POLICY IF EXISTS "Coordinators and directors view program requests" ON approval_requests;
DROP POLICY IF EXISTS "Coordinators and directors update program requests" ON approval_requests;

-- ============================================
-- STEP 3: Create clean policies for approval_requests
-- ============================================

-- Users can view their own approval requests
CREATE POLICY "users_view_own_requests" ON approval_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all approval requests
CREATE POLICY "admins_view_all_requests" ON approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    );

-- Chiefs, Coordinators, and Directors can view approval requests from their program
CREATE POLICY "leadership_view_program_requests" ON approval_requests
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

-- Admins can update all approval requests
CREATE POLICY "admins_update_all_requests" ON approval_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    );

-- Chiefs, Coordinators, and Directors can update approval requests from their program
CREATE POLICY "leadership_update_program_requests" ON approval_requests
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
    )
    WITH CHECK (
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

-- System can insert approval requests (via trigger)
CREATE POLICY "system_insert_requests" ON approval_requests
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- STEP 4: Drop ALL existing policies on profiles
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their program" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Leadership can approve users" ON profiles;

-- ============================================
-- STEP 5: Create clean policies for profiles
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (id = auth.uid());

-- Users can view profiles in the same program
CREATE POLICY "Users can view profiles in their program" ON profiles
    FOR SELECT
    USING (
        program_id = (
            SELECT program_id
            FROM profiles
            WHERE id = auth.uid()
            LIMIT 1
        )
        AND program_id IS NOT NULL
    );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Leadership can approve users in their program
CREATE POLICY "Leadership can approve users" ON profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles leader
            WHERE leader.id = auth.uid()
            AND leader.program_id = profiles.program_id
            AND leader.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND leader.is_approved = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles leader
            WHERE leader.id = auth.uid()
            AND leader.program_id = profiles.program_id
            AND leader.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
            AND leader.is_approved = true
        )
    );

-- ============================================
-- STEP 6: Update announcements policies
-- ============================================

DROP POLICY IF EXISTS "view_program_announcements" ON announcements;
DROP POLICY IF EXISTS "create_announcements" ON announcements;
DROP POLICY IF EXISTS "update_own_announcements" ON announcements;
DROP POLICY IF EXISTS "delete_announcements" ON announcements;
DROP POLICY IF EXISTS "Chiefs and coordinators can create announcements" ON announcements;
DROP POLICY IF EXISTS "Chiefs, coordinators, and directors can create announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can delete any announcement" ON announcements;
DROP POLICY IF EXISTS "Admins and coordinators can delete any announcement" ON announcements;

-- Anyone in the program can view announcements
CREATE POLICY "view_program_announcements" ON announcements
    FOR SELECT
    USING (
        program_id IN (
            SELECT program_id
            FROM profiles
            WHERE id = auth.uid()
        )
    );

-- Leadership can create announcements for their program
CREATE POLICY "leadership_create_announcements" ON announcements
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

-- Authors can update their own announcements
CREATE POLICY "update_own_announcements" ON announcements
    FOR UPDATE
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- Authors and Admins can delete announcements
CREATE POLICY "delete_announcements" ON announcements
    FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    );

-- ============================================
-- STEP 7: Update events policies (if table exists)
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
        -- Drop all existing events policies
        DROP POLICY IF EXISTS "Users can view events in their program" ON events;
        DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can create events" ON events;
        DROP POLICY IF EXISTS "Chiefs, coordinators, directors, and admins can create events" ON events;
        DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can update events" ON events;
        DROP POLICY IF EXISTS "Chiefs, coordinators, directors, and admins can update events" ON events;
        DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can delete events" ON events;
        DROP POLICY IF EXISTS "Chiefs, coordinators, directors, and admins can delete events" ON events;

        -- Users can view events in their program
        CREATE POLICY "Users can view events in their program" ON events
            FOR SELECT
            USING (
                program_id IN (
                    SELECT program_id
                    FROM profiles
                    WHERE id = auth.uid()
                )
            );

        -- Leadership can create events
        CREATE POLICY "leadership_create_events" ON events
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid()
                    AND role IN ('admin', 'program_coordinator', 'program_director', 'chief_resident')
                    AND is_approved = true
                )
            );

        -- Leadership can update events
        CREATE POLICY "leadership_update_events" ON events
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid()
                    AND role IN ('admin', 'program_coordinator', 'program_director', 'chief_resident')
                    AND is_approved = true
                )
            );

        -- Leadership can delete events
        CREATE POLICY "leadership_delete_events" ON events
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid()
                    AND role IN ('admin', 'program_coordinator', 'program_director', 'chief_resident')
                    AND is_approved = true
                )
            );

        RAISE NOTICE 'Updated events table policies';
    END IF;
END $$;

-- ============================================
-- STEP 8: Update auto-approve function
-- ============================================

CREATE OR REPLACE FUNCTION auto_approve_first_chief()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a leadership role completing their profile
    IF NEW.is_profile_complete = true
       AND OLD.is_profile_complete = false
       AND NEW.role IN ('chief_resident', 'program_coordinator', 'program_director')
       AND NEW.program_id IS NOT NULL THEN

        -- Check if there are any other approved leadership roles in this program
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

COMMENT ON FUNCTION auto_approve_first_chief IS 'Automatically approves the first Chief Resident, Program Coordinator, or Program Director of a program';

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all roles
SELECT 'All Roles:' as info;
SELECT enumlabel as role, enumsortorder
FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;

-- Show approval_requests policies
SELECT 'Approval Requests Policies:' as info;
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'approval_requests'
ORDER BY cmd, policyname;

-- Show profiles policies
SELECT 'Profiles Policies:' as info;
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Show announcements policies
SELECT 'Announcements Policies:' as info;
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'announcements'
ORDER BY cmd, policyname;
