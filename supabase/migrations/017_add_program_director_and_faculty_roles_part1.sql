-- Add program_director and faculty roles - Part 1: Add enum values
-- This must be run BEFORE part 2 because enum values must be committed before use

-- ============================================
-- ADD NEW ROLES TO user_role ENUM
-- ============================================

DO $$
BEGIN
    -- Add program_director role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'program_director'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'program_director';
        RAISE NOTICE 'Added program_director to user_role enum';
    ELSE
        RAISE NOTICE 'program_director already exists in user_role enum';
    END IF;

    -- Add faculty role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'faculty'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'faculty';
        RAISE NOTICE 'Added faculty to user_role enum';
    ELSE
        RAISE NOTICE 'faculty already exists in user_role enum';
    END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all roles in order
SELECT enumlabel as role, enumsortorder
FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
