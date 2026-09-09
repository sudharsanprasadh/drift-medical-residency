-- Migration 029 Part 1: Add Associate Program Director enum value
-- Run this FIRST, then run part 2 in a separate transaction

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'associate_program_director';
