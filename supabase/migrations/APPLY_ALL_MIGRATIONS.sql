-- ============================================
-- COMBINED MIGRATIONS: Apply all at once
-- Migrations 016, 017, and 018
-- ============================================

-- This file combines all pending migrations into one
-- Run this in Supabase SQL Editor to apply all changes

-- ============================================
-- MIGRATION 016: Align coordinator privileges with chief resident
-- ============================================

-- Drop the admin-level policies that included program_coordinator
DROP POLICY IF EXISTS "Admins and coordinators can view all approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Admins and coordinators can update approval requests" ON approval_requests;

-- Recreate admin-only policies
CREATE POLICY "Admins can view all approval requests" ON approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    );

CREATE POLICY "Admins can update approval requests" ON approval_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    );

-- ============================================
-- MIGRATION 017 PART 1: Add new role enum values
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
-- MIGRATION 017 PART 2: Update policies for new roles
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "chiefs_view_program_requests" ON approval_requests;
DROP POLICY IF EXISTS "chiefs_update_program_requests" ON approval_requests;
DROP POLICY IF EXISTS "Coordinators view program requests" ON approval_requests;
DROP POLICY IF EXISTS "Coordinators update program requests" ON approval_requests;

-- Create updated policies with new roles
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

-- Update announcements policies
DROP POLICY IF EXISTS "Admins and coordinators can delete any announcement" ON announcements;
DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "Chiefs and coordinators can create announcements" ON announcements;
DROP POLICY IF EXISTS "create_announcements" ON announcements;

CREATE POLICY "Admins can delete any announcement" ON announcements
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    );

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

-- Update events policies if they exist
DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can create events" ON events;
DROP POLICY IF EXISTS "Chiefs, coordinators, directors, and admins can create events" ON events;

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
DROP POLICY IF EXISTS "Chiefs, coordinators, directors, and admins can update events" ON events;

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
DROP POLICY IF EXISTS "Chiefs, coordinators, directors, and admins can delete events" ON events;

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

-- Update auto-approve function
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

-- ============================================
-- MIGRATION 018: Fix UPDATE policies with WITH CHECK
-- ============================================

-- Fix Admins update policy
DROP POLICY IF EXISTS "Admins can update approval requests" ON approval_requests;

CREATE POLICY "Admins can update approval requests" ON approval_requests
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

-- Fix Chiefs and Directors update policy
DROP POLICY IF EXISTS "Chiefs and directors update program requests" ON approval_requests;

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

-- Fix Coordinators and Directors update policy
DROP POLICY IF EXISTS "Coordinators and directors update program requests" ON approval_requests;

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
    )
    WITH CHECK (
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

-- Add policies for profiles table
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Leadership can approve users" ON profiles;

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

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
-- VERIFICATION
-- ============================================

-- Show all roles
SELECT enumlabel as role, enumsortorder
FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;

-- Show all approval_requests UPDATE policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'approval_requests'
AND cmd = 'UPDATE'
ORDER BY policyname;

-- Show all profiles UPDATE policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'profiles'
AND cmd = 'UPDATE'
ORDER BY policyname;
