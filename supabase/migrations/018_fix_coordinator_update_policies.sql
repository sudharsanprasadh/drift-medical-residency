-- Fix UPDATE policies to include WITH CHECK clause
-- RLS UPDATE policies require both USING (can see row) and WITH CHECK (can update to these values)

-- ============================================
-- FIX APPROVAL REQUEST UPDATE POLICIES
-- ============================================

-- Fix Admin update policy
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
DROP POLICY IF EXISTS "Coordinators update program requests" ON approval_requests;
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

-- Also need to ensure profiles UPDATE policy allows leadership to approve users
-- Check if there's a policy for updating profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Leadership can approve users" ON profiles;

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
-- COMMENTS
-- ============================================

COMMENT ON POLICY "Admins can update approval requests" ON approval_requests IS
'Admins can update any approval request. Includes WITH CHECK for proper RLS.';

COMMENT ON POLICY "Chiefs and directors update program requests" ON approval_requests IS
'Chiefs, Coordinators, and Directors can update approval requests from their program. Includes WITH CHECK for proper RLS.';

COMMENT ON POLICY "Coordinators and directors update program requests" ON approval_requests IS
'Program Coordinators and Directors can update approval requests from their program. Includes WITH CHECK for proper RLS.';

COMMENT ON POLICY "Leadership can approve users" ON profiles IS
'Leadership roles can update profiles (mainly to approve users) in their program.';

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all UPDATE policies on approval_requests
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE tablename = 'approval_requests'
AND cmd = 'UPDATE'
ORDER BY policyname;

-- Show all UPDATE policies on profiles
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
AND cmd = 'UPDATE'
ORDER BY policyname;
