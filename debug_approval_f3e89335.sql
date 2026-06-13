-- Debug script for profile f3e89335-6a37-4354-a91c-71d0b1a30a97
-- Run each section in Supabase SQL Editor

-- ============================================
-- 1. CHECK THE PROFILE
-- ============================================
SELECT
    id,
    email,
    first_name,
    last_name,
    role,
    program_id,
    is_profile_complete,
    is_approved,
    created_at,
    updated_at
FROM profiles
WHERE id = 'f3e89335-6a37-4354-a91c-71d0b1a30a97';

-- ============================================
-- 2. CHECK IF APPROVAL REQUEST EXISTS
-- ============================================
SELECT
    id,
    user_id,
    requested_role,
    status,
    reviewed_by,
    reviewed_at,
    notes,
    created_at
FROM approval_requests
WHERE user_id = 'f3e89335-6a37-4354-a91c-71d0b1a30a97';

-- ============================================
-- 3. CHECK YOUR CURRENT USER (who's viewing)
-- ============================================
SELECT
    auth.uid() as my_user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    p.program_id,
    p.is_approved
FROM profiles p
WHERE p.id = auth.uid();

-- ============================================
-- 4. CHECK IF RLS IS BLOCKING THE VIEW
-- ============================================
-- Try to see ALL approval requests (will only show what RLS allows)
SELECT
    ar.id,
    ar.user_id,
    ar.requested_role,
    ar.status,
    p.email,
    p.first_name,
    p.last_name,
    p.program_id
FROM approval_requests ar
LEFT JOIN profiles p ON ar.user_id = p.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at DESC;

-- ============================================
-- 5. IF NO APPROVAL REQUEST EXISTS, CREATE ONE MANUALLY
-- ============================================
-- ONLY RUN THIS IF SECTION 2 SHOWS NO RESULTS
-- Get the role from the profile first, then insert

-- First check the role:
SELECT role FROM profiles WHERE id = 'f3e89335-6a37-4354-a91c-71d0b1a30a97';

-- Then insert (replace 'resident' with actual role if different):
INSERT INTO approval_requests (user_id, requested_role, status)
VALUES ('f3e89335-6a37-4354-a91c-71d0b1a30a97', 'resident', 'pending')
ON CONFLICT DO NOTHING;

-- Verify it was created:
SELECT * FROM approval_requests WHERE user_id = 'f3e89335-6a37-4354-a91c-71d0b1a30a97';

-- ============================================
-- 6. CHECK IF TRIGGER EXISTS
-- ============================================
SELECT
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_create_approval_request';

-- ============================================
-- 7. IF PROFILES ARE IN DIFFERENT PROGRAMS (for Chief Residents)
-- ============================================
-- Check if the requesting user and viewing user are in the same program
SELECT
    'Requesting User' as type,
    p1.id,
    p1.email,
    p1.first_name,
    p1.last_name,
    p1.program_id,
    prog1.program_name
FROM profiles p1
LEFT JOIN programs prog1 ON p1.program_id = prog1.id
WHERE p1.id = 'f3e89335-6a37-4354-a91c-71d0b1a30a97'

UNION ALL

SELECT
    'Your User' as type,
    p2.id,
    p2.email,
    p2.first_name,
    p2.last_name,
    p2.program_id,
    prog2.program_name
FROM profiles p2
LEFT JOIN programs prog2 ON p2.program_id = prog2.id
WHERE p2.id = auth.uid();
