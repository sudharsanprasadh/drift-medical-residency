-- Check pending approvals for Chief Resident: 96ce8df9-2dbb-4301-ad24-c5507db5a248
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CHECK THE CHIEF RESIDENT'S PROFILE
-- ============================================
SELECT
    '=== CHIEF RESIDENT PROFILE ===' as section,
    id,
    email,
    first_name,
    last_name,
    role,
    program_id,
    is_approved,
    is_profile_complete,
    created_at
FROM profiles
WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- ============================================
-- 2. GET THE PROGRAM DETAILS
-- ============================================
SELECT
    '=== CHIEF RESIDENT PROGRAM ===' as section,
    prog.id as program_id,
    prog.program_name,
    prog.specialty,
    prog.location
FROM profiles p
JOIN programs prog ON p.program_id = prog.id
WHERE p.id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- ============================================
-- 3. FIND ALL USERS IN THE SAME PROGRAM
-- ============================================
SELECT
    '=== ALL USERS IN SAME PROGRAM ===' as section,
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.is_profile_complete,
    p.is_approved,
    CASE
        WHEN p.is_profile_complete = false THEN 'Profile Incomplete'
        WHEN p.is_approved = true THEN 'Already Approved'
        ELSE 'Needs Approval'
    END as status
FROM profiles p
WHERE p.program_id = (
    SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
)
ORDER BY p.created_at DESC;

-- ============================================
-- 4. FIND PENDING APPROVAL REQUESTS IN SAME PROGRAM
-- ============================================
SELECT
    '=== PENDING REQUESTS IN SAME PROGRAM ===' as section,
    ar.id as request_id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.role as requested_role,
    ar.status,
    ar.created_at as request_created
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending'
  AND p.program_id = (
    SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
  )
ORDER BY ar.created_at DESC;

-- ============================================
-- 5. CHECK IF CHIEF CAN SEE THESE (RLS TEST)
-- ============================================
-- This simulates what the Chief Resident would see when logged in
-- We need to check the RLS policy
SELECT
    '=== RLS POLICY CHECK ===' as section,
    CASE
        WHEN (SELECT is_approved FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') = false
        THEN 'PROBLEM: Chief Resident is not approved yet'
        WHEN (SELECT role FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') != 'chief_resident'
        THEN 'PROBLEM: User is not a Chief Resident'
        WHEN (SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248') IS NULL
        THEN 'PROBLEM: Chief Resident has no program assigned'
        ELSE 'OK: Chief Resident should be able to see program requests'
    END as rls_status;

-- ============================================
-- 6. USERS NEEDING APPROVAL IN THIS PROGRAM
-- ============================================
SELECT
    '=== USERS NEEDING APPROVAL (no request yet) ===' as section,
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.is_profile_complete,
    p.is_approved
FROM profiles p
LEFT JOIN approval_requests ar ON p.id = ar.user_id
WHERE p.program_id = (
    SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
)
AND p.is_profile_complete = true
AND p.is_approved = false
AND ar.id IS NULL;

-- ============================================
-- 7. CREATE MISSING APPROVAL REQUESTS FOR THIS PROGRAM
-- ============================================
INSERT INTO approval_requests (user_id, requested_role, status)
SELECT
    p.id,
    p.role,
    'pending'
FROM profiles p
LEFT JOIN approval_requests ar ON p.id = ar.user_id
WHERE p.program_id = (
    SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
)
AND p.is_profile_complete = true
AND p.is_approved = false
AND ar.id IS NULL
ON CONFLICT DO NOTHING
RETURNING
    'Created approval request' as action,
    user_id,
    requested_role,
    status;

-- ============================================
-- 8. FINAL CHECK - WHAT SHOULD BE VISIBLE
-- ============================================
SELECT
    '=== FINAL: PENDING REQUESTS IN PROGRAM ===' as section,
    ar.id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    ar.status,
    ar.created_at
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending'
  AND p.program_id = (
    SELECT program_id FROM profiles WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248'
  )
ORDER BY ar.created_at DESC;

-- ============================================
-- 9. QUICK FIXES (if needed)
-- ============================================

-- FIX A: Approve this Chief Resident (if they're not approved)
-- UPDATE profiles
-- SET is_approved = true
-- WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- FIX B: Make them Chief Resident (if role is wrong)
-- UPDATE profiles
-- SET role = 'chief_resident', is_approved = true
-- WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';

-- FIX C: Assign them to a program (if program_id is NULL)
-- UPDATE profiles
-- SET program_id = 'PROGRAM_ID_HERE'
-- WHERE id = '96ce8df9-2dbb-4301-ad24-c5507db5a248';
