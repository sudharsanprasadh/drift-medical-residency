-- Auto-approve the first Chief Resident of each program
-- This solves the chicken-and-egg problem

CREATE OR REPLACE FUNCTION auto_approve_first_chief()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a Chief Resident completing their profile
    IF NEW.is_profile_complete = true
       AND OLD.is_profile_complete = false
       AND NEW.role = 'chief_resident'
       AND NEW.program_id IS NOT NULL THEN

        -- Check if there are any other approved Chief Residents in this program
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE program_id = NEW.program_id
              AND role IN ('chief_resident', 'admin')
              AND is_approved = true
              AND id != NEW.id
        ) THEN
            -- This is the first Chief/Admin in the program - auto-approve
            NEW.is_approved := true;

            RAISE NOTICE 'Auto-approved first Chief Resident for program %', NEW.program_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-approve first Chief
DROP TRIGGER IF EXISTS trigger_auto_approve_first_chief ON profiles;

CREATE TRIGGER trigger_auto_approve_first_chief
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_approve_first_chief();

-- Comment
COMMENT ON FUNCTION auto_approve_first_chief IS 'Automatically approves the first Chief Resident of a program to solve the bootstrapping problem';
