-- Add program_coordinator role - Part 1: Add enum value
-- This must be run BEFORE part 2 because enum values must be committed before use

-- ============================================
-- ADD PROGRAM_COORDINATOR TO user_role ENUM
-- ============================================
DO $$
BEGIN
    -- Check if the value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'program_coordinator'
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE user_role ADD VALUE 'program_coordinator';
        RAISE NOTICE 'Added program_coordinator to user_role enum';
    ELSE
        RAISE NOTICE 'program_coordinator already exists in user_role enum';
    END IF;
END $$;

-- Verify the enum value was added
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
