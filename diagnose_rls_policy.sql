-- Diagnose RLS Policy Blocking Chief Resident 96ce8df9-2dbb-4301-ad24-c5507db5a248
-- This will show us EXACTLY why RLS is blocking

-- ============================================
-- 1. VERIFY CHIEF'S PROFILE
-- ============================================
SELECT
    '=== CHIEF PROFILE ===' as section,
    id,
    email,
    first_name,
    last_name,
    role,
    program_id,
    is_approved,
    is_profile_complete
FROM profiles
WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- ============================================
-- 2. CHECK ALL RLS POLICIES ON approval_requests
-- ============================================
SELECT
    '=== RLS POLICIES ON approval_requests ===' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE tablename = 'approval_requests'
ORDER BY policyname;

-- ============================================
-- 3. TEST THE EXACT RLS CONDITION FOR CHIEFS
-- ============================================
-- This tests if the Chief meets the RLS requirements
SELECT
    '=== RLS CONDITION TEST ===' as section,
    p1.id as chief_id,
    p1.email as chief_email,
    p1.role as chief_role,
    p1.program_id as chief_program,
    p1.is_approved as chief_approved,
    COUNT(p2.id) as residents_in_same_program,
    COUNT(ar.id) as pending_requests_same_program
FROM profiles p1
LEFT JOIN profiles p2 ON p1.program_id = p2.program_id AND p2.id != p1.id
LEFT JOIN approval_requests ar ON ar.user_id = p2.id AND ar.status = 'pending'
WHERE p1.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
GROUP BY p1.id, p1.email, p1.role, p1.program_id, p1.is_approved;

-- ============================================
-- 4. SHOW ALL PENDING REQUESTS WITH PROGRAM MATCH
-- ============================================
SELECT
    '=== PENDING REQUESTS & PROGRAM MATCH ===' as section,
    ar.id as request_id,
    ar.user_id,
    p_user.email as user_email,
    p_user.first_name,
    p_user.last_name,
    p_user.program_id as user_program,
    (SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_program,
    CASE
        WHEN p_user.program_id = (SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248')
        THEN '✅ SAME PROGRAM'
        ELSE '❌ DIFFERENT PROGRAM'
    END as program_match,
    ar.status
FROM approval_requests ar
JOIN profiles p_user ON ar.user_id = p_user.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;

-- ============================================
-- 5. TEST EXACT RLS LOGIC (simulating the policy)
-- ============================================
SELECT
    '=== EXACT RLS SIMULATION ===' as section,
    ar.id,
    ar.user_id,
    p2.email,
    p2.first_name,
    p2.last_name,
    -- Test the EXISTS clause from RLS policy
    CASE
        WHEN EXISTS (
            SELECT 1 FROM profiles p1
            JOIN profiles p2_inner ON p1.program_id = p2_inner.program_id
            WHERE p1.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
            AND p1.role = 'chief_resident'
            AND p1.is_approved = true
            AND p2_inner.id = ar.user_id
        ) THEN '✅ RLS SHOULD ALLOW'
        ELSE '❌ RLS BLOCKS - WHY?'
    END as rls_result,
    -- Break down WHY it might block
    (SELECT role FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_role,
    (SELECT is_approved FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_approved,
    (SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_program,
    p2.program_id as user_program
FROM approval_requests ar
JOIN profiles p2 ON ar.user_id = p2.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;

-- ============================================
-- 6. CHECK IF RLS IS ACTUALLY ENABLED
-- ============================================
SELECT
    '=== RLS STATUS ===' as section,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'approval_requests';

-- ============================================
-- 7. FIX - DROP AND RECREATE THE POLICY
-- ============================================
-- If the policy is broken, this will fix it

-- Drop existing policies
DROP POLICY IF EXISTS "Chiefs can view program approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Chief residents can view approval requests for their program" ON approval_requests;

-- Recreate the correct policy
CREATE POLICY "Chiefs can view program approval requests" ON approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p1
            JOIN profiles p2 ON p1.program_id = p2.program_id
            WHERE p1.id = auth.uid()
            AND p1.role = 'chief_resident'
            AND p1.is_approved = true
            AND p2.id = approval_requests.user_id
        )
    );

-- ============================================
-- 8. VERIFY THE FIX
-- ============================================
SELECT
    '=== AFTER FIX - POLICY CHECK ===' as section,
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'approval_requests'
  AND policyname LIKE '%Chiefs%';

-- ============================================
-- 9. FINAL TEST - What can Chief see now?
-- ============================================
SELECT
    '=== FINAL: REQUESTS CHIEF SHOULD SEE ===' as section,
    ar.id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    ar.status,
    ar.created_at
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending'
  AND EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p1.program_id = p2.program_id
      WHERE p1.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
      AND p1.role = 'chief_resident'
      AND p1.is_approved = true
      AND p2.id = ar.user_id
  )
ORDER BY ar.created_at DESC;
