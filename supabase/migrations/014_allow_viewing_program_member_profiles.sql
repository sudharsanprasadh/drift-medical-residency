-- Allow users to view profiles of other members in their program
-- This fixes "Unknown Author" issue in announcements and enables viewing program members

-- ============================================
-- ADD POLICY TO VIEW PROGRAM MEMBER PROFILES
-- ============================================

-- Users can view profiles of other members in the same program
-- Note: Removed is_approved requirement for viewer so pending users can see program members
CREATE POLICY "Users can view profiles in their program" ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles viewer
            WHERE viewer.id = auth.uid()
            AND viewer.program_id = profiles.program_id
            AND viewer.program_id IS NOT NULL
        )
    );

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all SELECT policies on profiles table
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'profiles'
AND cmd = 'SELECT'
ORDER BY policyname;

-- Comment
COMMENT ON POLICY "Users can view profiles in their program" ON profiles IS 'Allows approved users to view profiles of other members in the same program for announcements, program members list, etc.';
