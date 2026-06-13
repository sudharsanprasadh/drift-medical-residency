-- Test what Chief Resident 96ce8df9-2dbb-4301-ad24-c5507db5a248 can ACTUALLY see
-- This simulates RLS as that user would experience it

-- ============================================
-- CRITICAL: Check if Chief is APPROVED
-- ============================================
-- RLS policy REQUIRES is_approved = true for Chief Residents to see anything!
SELECT
    'CRITICAL CHECK' as alert,
    id,
    email,
    first_name,
    last_name,
    role,
    is_approved,
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
-- TEST RLS POLICY SIMULATION
-- ============================================
-- This simulates what the Chief sees with RLS enforced
-- The RLS policy for Chiefs is:
-- EXISTS (
--   SELECT 1 FROM profiles p1
--   JOIN profiles p2 ON p1.program_id = p2.program_id
--   WHERE p1.id = auth.uid()
--   AND p1.role = 'chief_resident'
--   AND p1.is_approved = true  <-- THIS IS THE KEY!
--   AND p2.id = approval_requests.user_id
-- )

-- Simulate the RLS check:
SELECT
    'RLS SIMULATION' as test,
    ar.id,
    ar.user_id,
    p_requesting.email,
    p_requesting.first_name,
    p_requesting.last_name,
    ar.status,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM profiles p_chief
            JOIN profiles p_req ON p_chief.program_id = p_req.program_id
            WHERE p_chief.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
            AND p_chief.role = 'chief_resident'
            AND p_chief.is_approved = true
            AND p_req.id = ar.user_id
        ) THEN '✅ VISIBLE (RLS allows)'
        ELSE '❌ HIDDEN (RLS blocks)'
    END as visibility
FROM approval_requests ar
JOIN profiles p_requesting ON ar.user_id = p_requesting.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;

-- ============================================
-- WHY RLS IS BLOCKING - DETAILED CHECK
-- ============================================
SELECT
    'WHY IS RLS BLOCKING?' as question,
    (SELECT is_approved FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_is_approved,
    (SELECT role FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_role,
    (SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') as chief_program_id,
    COUNT(ar.id) as total_pending_requests,
    COUNT(CASE
        WHEN p.program_id = (SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248')
        THEN 1
    END) as pending_in_same_program
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending';

-- ============================================
-- FIX: APPROVE THE CHIEF RESIDENT
-- ============================================
-- If the Chief is NOT approved, run this to approve them:

UPDATE profiles
SET is_approved = true
WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- Verify the fix:
SELECT
    'AFTER FIX' as status,
    id,
    email,
    first_name,
    last_name,
    role,
    is_approved,
    CASE
        WHEN is_approved = true THEN '✅ NOW APPROVED - Can see approval requests'
        ELSE '❌ Still not approved'
    END as result
FROM profiles
WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- ============================================
-- FINAL TEST: What can they see now?
-- ============================================
SELECT
    'FINAL: WHAT CHIEF CAN SEE NOW' as final_check,
    ar.id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    ar.status
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending'
  AND EXISTS (
      SELECT 1 FROM profiles p_chief
      JOIN profiles p_req ON p_chief.program_id = p_req.program_id
      WHERE p_chief.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
      AND p_chief.role = 'chief_resident'
      AND p_chief.is_approved = true
      AND p_req.id = ar.user_id
  )
ORDER BY ar.created_at DESC;
