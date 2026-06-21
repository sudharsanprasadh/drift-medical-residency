-- Align program_coordinator privileges with chief_resident
-- Change program coordinators from admin-level (all programs) to program-scoped (their own program only)

-- ============================================
-- 1. UPDATE APPROVAL REQUEST POLICIES
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

-- Add program-scoped policies for program coordinators (matching chief residents)
CREATE POLICY "Coordinators view program requests" ON approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles coordinator
            INNER JOIN profiles applicant ON coordinator.program_id = applicant.program_id
            WHERE coordinator.id = auth.uid()
            AND coordinator.role = 'program_coordinator'
            AND coordinator.is_approved = true
            AND coordinator.program_id IS NOT NULL
            AND applicant.id = approval_requests.user_id
            AND applicant.program_id IS NOT NULL
        )
    );

CREATE POLICY "Coordinators update program requests" ON approval_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles coordinator
            INNER JOIN profiles applicant ON coordinator.program_id = applicant.program_id
            WHERE coordinator.id = auth.uid()
            AND coordinator.role = 'program_coordinator'
            AND coordinator.is_approved = true
            AND coordinator.program_id IS NOT NULL
            AND applicant.id = approval_requests.user_id
            AND applicant.program_id IS NOT NULL
        )
    );

-- ============================================
-- 2. UPDATE ANNOUNCEMENTS POLICIES
-- ============================================

-- Drop the policy that gave coordinators delete privileges
DROP POLICY IF EXISTS "Admins and coordinators can delete any announcement" ON announcements;

-- Recreate admin-only delete policy (authors can still delete their own via another policy)
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

-- Ensure the create policy includes program coordinators
DROP POLICY IF EXISTS "Chiefs, coordinators, and admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "create_announcements" ON announcements;

CREATE POLICY "Chiefs and coordinators can create announcements" ON announcements
    FOR INSERT
    WITH CHECK (
        author_id = auth.uid()
        AND program_id IN (
            SELECT program_id
            FROM profiles
            WHERE id = auth.uid()
            AND is_approved = true
            AND role IN ('chief_resident', 'program_coordinator', 'admin')
        )
    );

-- ============================================
-- 3. ADD COMMENTS FOR CLARITY
-- ============================================

COMMENT ON POLICY "Coordinators view program requests" ON approval_requests IS
'Program Coordinators can only view approval requests from residents in their program';

COMMENT ON POLICY "Coordinators update program requests" ON approval_requests IS
'Program Coordinators can only approve/reject residents from their own program';

COMMENT ON POLICY "Chiefs and coordinators can create announcements" ON announcements IS
'Chiefs and Program Coordinators can post announcements to their program';

-- ============================================
-- 4. VERIFICATION QUERIES
-- ============================================

-- Show all approval_requests policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as using_clause
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
