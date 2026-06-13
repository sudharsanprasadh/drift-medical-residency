-- Fix infinite recursion in profiles RLS policy
-- The previous policy tried to join profiles to itself, causing infinite recursion

-- ============================================
-- 1. DROP THE PROBLEMATIC POLICY
-- ============================================
DROP POLICY IF EXISTS "Users can view profiles in their program" ON profiles;

-- ============================================
-- 2. CREATE HELPER FUNCTION
-- ============================================
-- This function gets the current user's program_id without triggering RLS
CREATE OR REPLACE FUNCTION get_my_program_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT program_id
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Set permissions
GRANT EXECUTE ON FUNCTION get_my_program_id() TO authenticated;

-- ============================================
-- 3. CREATE NEW POLICY WITHOUT RECURSION
-- ============================================
-- Users can view profiles of members in the same program
CREATE POLICY "Users can view profiles in their program" ON profiles
    FOR SELECT
    USING (
        -- Allow if the profile being viewed is in the same program as the viewer
        program_id = get_my_program_id()
        AND program_id IS NOT NULL
    );

-- ============================================
-- 4. VERIFICATION
-- ============================================

-- Show all SELECT policies on profiles
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

-- Test the function
SELECT get_my_program_id() as my_program_id;

-- Comment
COMMENT ON FUNCTION get_my_program_id IS 'Returns the current authenticated user''s program_id without triggering RLS recursion';
COMMENT ON POLICY "Users can view profiles in their program" ON profiles IS 'Allows users to view profiles of other members in the same program. Uses helper function to avoid RLS recursion.';
