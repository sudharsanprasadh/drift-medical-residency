-- CORRECTED: Test RLS for Chief Resident 96ce8df9-2dbb-4301-ad24-c5507db5a248
-- Fixed the ambiguous relationship error

-- ============================================
-- 1. CHECK IF CHIEF IS APPROVED
-- ============================================
SELECT
    'CRITICAL CHECK' as alert,
    id,
    email,
    first_name,
    last_name,
    role,
    is_approved,
    program_id,
    CASE
        WHEN role = 'chief_resident' AND is_approved = false
        THEN '❌ PROBLEM: Chief must be APPROVED to see approval requests!'
        WHEN role = 'chief_resident' AND is_approved = true
        THEN '✅ OK: Chief is approved and can see requests'
        ELSE '⚠️ WARNING: Not a Chief Resident'
    END as rls_status
FROM profiles
WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- ============================================
-- 2. APPROVE THE CHIEF (if not approved)
-- ============================================
UPDATE profiles
SET is_approved = true
WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
AND is_approved = false;

-- ============================================
-- 3. VERIFY THE FIX
-- ============================================
SELECT
    'AFTER APPROVAL' as status,
    id,
    email,
    first_name || ' ' || last_name as full_name,
    role,
    is_approved,
    program_id,
    CASE
        WHEN is_approved = true THEN '✅ NOW APPROVED - Refresh the app!'
        ELSE '❌ Still not approved'
    END as result
FROM profiles
WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- ============================================
-- 4. CHECK PENDING REQUESTS IN CHIEF'S PROGRAM
-- ============================================
SELECT
    'PENDING REQUESTS IN PROGRAM' as section,
    ar.id as request_id,
    ar.user_id,
    p_user.email,
    p_user.first_name,
    p_user.last_name,
    p_user.role,
    ar.status,
    ar.created_at,
    prog.program_name
FROM approval_requests ar
JOIN profiles p_user ON ar.user_id = p_user.id  -- Using user_id relationship
LEFT JOIN programs prog ON p_user.program_id = prog.id
WHERE ar.status = 'pending'
  AND p_user.program_id = (
      SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
  )
ORDER BY ar.created_at DESC;

-- ============================================
-- 5. RLS SIMULATION - What Chief Can See
-- ============================================
-- This simulates the exact RLS policy
SELECT
    'RLS TEST - VISIBILITY CHECK' as test,
    ar.id as request_id,
    p_user.email,
    p_user.first_name,
    p_user.last_name,
    ar.status,
    -- Check if RLS would allow this
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM profiles p_chief
            WHERE p_chief.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
              AND p_chief.role = 'chief_resident'
              AND p_chief.is_approved = true
              AND p_chief.program_id = p_user.program_id
        ) THEN '✅ VISIBLE (Chief can see this)'
        ELSE '❌ HIDDEN (RLS blocks)'
    END as visibility_status
FROM approval_requests ar
JOIN profiles p_user ON ar.user_id = p_user.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;

-- ============================================
-- 6. SUMMARY - What You Need to Know
-- ============================================
SELECT
    'SUMMARY' as section,
    (SELECT COUNT(*) FROM approval_requests WHERE status = 'pending') as total_pending_requests,
    (SELECT is_approved FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_is_approved,
    (SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_program_id,
    COUNT(*) as requests_chief_can_see
FROM approval_requests ar
JOIN profiles p_user ON ar.user_id = p_user.id
WHERE ar.status = 'pending'
  AND p_user.program_id = (
      SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
  )
  AND EXISTS (
      SELECT 1 FROM profiles p_chief
      WHERE p_chief.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
        AND p_chief.role = 'chief_resident'
        AND p_chief.is_approved = true
  );
