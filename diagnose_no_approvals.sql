-- Diagnose why you're seeing "No pending approvals from your program"
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CHECK YOUR PROFILE (the person viewing)
-- ============================================
SELECT
    '=== YOUR PROFILE ===' as section,
    id,
    email,
    first_name,
    last_name,
    role,
    program_id,
    is_approved,
    is_profile_complete
FROM profiles
WHERE id = auth.uid();

-- ============================================
-- 2. CHECK ALL PENDING APPROVAL REQUESTS
-- ============================================
SELECT
    '=== ALL PENDING REQUESTS ===' as section,
    ar.id as request_id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.program_id,
    ar.status,
    ar.created_at
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;

-- ============================================
-- 3. CHECK PROGRAM MATCH
-- ============================================
-- Show your program vs pending users' programs
SELECT
    '=== PROGRAM COMPARISON ===' as section,
    'YOU' as user_type,
    p.email,
    p.program_id,
    prog.program_name
FROM profiles p
LEFT JOIN programs prog ON p.program_id = prog.id
WHERE p.id = auth.uid()

UNION ALL

SELECT
    '=== PROGRAM COMPARISON ===' as section,
    'PENDING USER' as user_type,
    p.email,
    p.program_id,
    prog.program_name
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
LEFT JOIN programs prog ON p.program_id = prog.id
WHERE ar.status = 'pending'
ORDER BY user_type;

-- ============================================
-- 4. WHAT CAN YOU SEE? (RLS Test)
-- ============================================
-- This shows what RLS allows you to see
SELECT
    '=== WHAT RLS ALLOWS YOU TO SEE ===' as section,
    ar.id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    ar.status
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id;

-- ============================================
-- 5. FIND PROFILES THAT NEED APPROVAL REQUESTS
-- ============================================
SELECT
    '=== PROFILES NEEDING APPROVAL (no request yet) ===' as section,
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.program_id,
    p.is_profile_complete,
    p.is_approved
FROM profiles p
LEFT JOIN approval_requests ar ON p.id = ar.user_id
WHERE p.is_profile_complete = true
  AND p.is_approved = false
  AND ar.id IS NULL;

-- ============================================
-- 6. FIX: CREATE MISSING APPROVAL REQUESTS
-- ============================================
-- Run this to create approval requests for profiles that don't have them
INSERT INTO approval_requests (user_id, requested_role, status)
SELECT
    p.id,
    p.role,
    'pending'
FROM profiles p
LEFT JOIN approval_requests ar ON p.id = ar.user_id
WHERE p.is_profile_complete = true
  AND p.is_approved = false
  AND ar.id IS NULL
ON CONFLICT DO NOTHING
RETURNING *;

-- ============================================
-- 7. QUICK FIXES (run if needed)
-- ============================================

-- FIX A: Make yourself an ADMIN (if you need to see all requests across programs)
-- UPDATE profiles SET role = 'admin', is_approved = true WHERE id = auth.uid();

-- FIX B: Make yourself a CHIEF RESIDENT in a specific program
-- UPDATE profiles SET role = 'chief_resident', is_approved = true, program_id = 'PROGRAM_ID_HERE' WHERE id = auth.uid();

-- FIX C: Verify the fix worked
SELECT
    'After fixes, you should see:' as note,
    COUNT(*) as pending_count
FROM approval_requests
WHERE status = 'pending';
