-- Migration to completely remove the on-call schedule system
-- Run this migration to drop all schedule-related tables and types

-- ============================================
-- DROP TABLES (in correct order to respect foreign keys)
-- ============================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS duty_hours CASCADE;
DROP TABLE IF EXISTS acgme_violations CASCADE;
DROP TABLE IF EXISTS shift_swap_requests CASCADE;
DROP TABLE IF EXISTS oncall_shifts CASCADE;
DROP TABLE IF EXISTS oncall_schedules CASCADE;

-- ============================================
-- DROP ENUMS/TYPES
-- ============================================

DROP TYPE IF EXISTS swap_status CASCADE;
DROP TYPE IF EXISTS schedule_status CASCADE;
DROP TYPE IF EXISTS shift_type CASCADE;
DROP TYPE IF EXISTS call_type CASCADE;

-- ============================================
-- CLEANUP
-- ============================================

-- Note: This migration removes all schedule functionality
-- All schedule data will be permanently deleted
-- Make sure to backup data before running this migration if needed
