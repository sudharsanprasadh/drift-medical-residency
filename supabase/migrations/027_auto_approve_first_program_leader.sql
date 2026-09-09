-- Auto-approve the first leader of a program
-- When someone completes their profile as a leadership role for a program
-- that has no existing approved leaders, auto-approve them.

CREATE OR REPLACE FUNCTION auto_approve_first_program_leader()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when profile is being completed (is_profile_complete set to true)
  IF NEW.is_profile_complete = true
    AND NEW.is_approved = false
    AND NEW.program_id IS NOT NULL
    AND NEW.role IN ('chief_resident', 'program_coordinator', 'program_director')
  THEN
    -- Check if this program has any existing approved leaders
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE program_id = NEW.program_id
      AND id != NEW.id
      AND is_approved = true
      AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
    ) THEN
      -- No leaders exist — auto-approve this user as the first leader
      NEW.is_approved := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_approve_first_leader
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_first_program_leader();
