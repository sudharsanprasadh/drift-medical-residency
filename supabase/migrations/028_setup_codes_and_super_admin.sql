-- Setup codes for programs + super admin support
-- Each program gets a unique setup code that the first leader must enter to get auto-approved.
-- This prevents bad actors from self-approving as leaders.

-- ============================================
-- 1. ADD SETUP CODE INPUT TO PROFILES (transient field)
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS setup_code_input TEXT;

-- ============================================
-- 2. CREATE PROGRAM SETUP CODES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS program_setup_codes (
  program_id UUID PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE,
  setup_code TEXT NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 6)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE program_setup_codes ENABLE ROW LEVEL SECURITY;

-- Leaders of the program and admins can view setup codes
CREATE POLICY "Leaders can view their program setup code" ON program_setup_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_approved = true
      AND (
        role = 'admin'
        OR (program_id = program_setup_codes.program_id
            AND role IN ('chief_resident', 'program_coordinator', 'program_director'))
      )
    )
  );

-- Admins can manage all setup codes
CREATE POLICY "Admins can manage setup codes" ON program_setup_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND is_approved = true
    )
  );

-- ============================================
-- 3. SEED SETUP CODES FOR EXISTING PROGRAMS
-- ============================================

INSERT INTO program_setup_codes (program_id, setup_code)
SELECT id, upper(substr(md5(random()::text), 1, 6))
FROM programs
ON CONFLICT (program_id) DO NOTHING;

-- Auto-create setup code when a new program is inserted
CREATE OR REPLACE FUNCTION create_setup_code_for_program()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO program_setup_codes (program_id)
  VALUES (NEW.id)
  ON CONFLICT (program_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_setup_code
  AFTER INSERT ON programs
  FOR EACH ROW
  EXECUTE FUNCTION create_setup_code_for_program();

-- ============================================
-- 4. UPDATE AUTO-APPROVE TRIGGER
-- ============================================

-- Replace the trigger function to require setup code
CREATE OR REPLACE FUNCTION auto_approve_first_program_leader()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_code TEXT;
BEGIN
  -- Only act when profile is being completed as a leadership role
  IF NEW.is_profile_complete = true
    AND NEW.is_approved = false
    AND NEW.program_id IS NOT NULL
    AND NEW.role IN ('chief_resident', 'program_coordinator', 'program_director')
    AND NEW.setup_code_input IS NOT NULL
    AND trim(NEW.setup_code_input) != ''
  THEN
    -- Get the program's setup code (SECURITY DEFINER bypasses RLS)
    SELECT setup_code INTO stored_code
    FROM program_setup_codes
    WHERE program_id = NEW.program_id;

    -- Check if code matches
    IF stored_code IS NOT NULL
      AND upper(trim(NEW.setup_code_input)) = upper(trim(stored_code))
    THEN
      -- Check if this program has no existing approved leaders
      IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE program_id = NEW.program_id
        AND id != NEW.id
        AND is_approved = true
        AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
      ) THEN
        NEW.is_approved := true;
      END IF;
    END IF;
  END IF;

  -- Always clear the setup code input (never persist it)
  NEW.setup_code_input := NULL;

  RETURN NEW;
END;
$$;

-- The trigger itself was created in migration 027, no need to recreate

-- ============================================
-- 5. RPC TO REGENERATE SETUP CODE
-- ============================================

CREATE OR REPLACE FUNCTION regenerate_setup_code(p_program_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Check authorization: must be admin or approved leader of this program
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_approved = true
    AND (
      role = 'admin'
      OR (program_id = p_program_id AND role IN ('chief_resident', 'program_coordinator', 'program_director'))
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to regenerate setup code';
  END IF;

  new_code := upper(substr(md5(random()::text), 1, 6));

  UPDATE program_setup_codes
  SET setup_code = new_code, updated_at = NOW()
  WHERE program_id = p_program_id;

  RETURN new_code;
END;
$$;

-- ============================================
-- 6. SUPER ADMIN NOTES
-- ============================================

-- The 'admin' role already exists in the system and has cross-program
-- visibility via existing RLS policies (migrations 001, 016).
--
-- To create the first super admin, run this SQL in Supabase SQL Editor
-- replacing the email with the desired admin's email:
--
--   UPDATE profiles
--   SET role = 'admin', is_approved = true
--   WHERE email = 'your-admin@email.com';
--
-- Or to create a fresh admin user:
--   1. Have the person register normally through the app
--   2. Run the SQL above to promote them
--
-- Admins can:
--   - View and approve/reject ALL pending requests from ALL programs
--   - View all profiles across programs
--   - Manage program setup codes
