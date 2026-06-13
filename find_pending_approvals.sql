-- Find all profiles that need approval
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. FIND ALL PROFILES WAITING FOR APPROVAL
-- ============================================
SELECT
    id,
    email,
    first_name,
    last_name,
    role,
    program_id,
    pgy,
    is_profile_complete,
    is_approved,
    created_at,
    updated_at
FROM profiles
WHERE is_profile_complete = true
  AND is_approved = false
ORDER BY created_at DESC;

-- ============================================
-- 2. CHECK WHICH ONES HAVE APPROVAL REQUESTS
-- ============================================
SELECT
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.program_id,
    CASE
        WHEN ar.id IS NOT NULL THEN 'Has Request'
        ELSE 'Missing Request'
    END as approval_request_status,
    ar.status as request_status,
    ar.created_at as request_created_at
FROM profiles p
LEFT JOIN approval_requests ar ON p.id = ar.user_id
WHERE p.is_profile_complete = true
  AND p.is_approved = false
ORDER BY p.created_at DESC;

-- ============================================
-- 3. CREATE MISSING APPROVAL REQUESTS
-- ============================================
-- This will create approval requests for any completed profiles that don't have one
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
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. VERIFY ALL PENDING APPROVALS NOW EXIST
-- ============================================
SELECT
    ar.id as request_id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    ar.requested_role,
    ar.status,
    p.program_id,
    prog.program_name,
    ar.created_at as request_created
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
LEFT JOIN programs prog ON p.program_id = prog.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;

-- ============================================
-- 5. CHECK WHAT YOU CAN SEE (as current user)
-- ============================================
-- Your profile
SELECT
    'YOUR PROFILE' as label,
    id,
    email,
    first_name,
    last_name,
    role,
    program_id,
    is_approved
FROM profiles
WHERE id = auth.uid();

-- Approval requests you should be able to see
SELECT
    'REQUESTS YOU CAN SEE' as label,
    ar.id,
    ar.user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    ar.status
FROM approval_requests ar
JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;
