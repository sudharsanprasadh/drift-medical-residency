-- Migration 029 Part 2: Update RLS policies for Associate Program Director
-- Run this AFTER part 1 has been committed

-- ============================================================
-- Profiles: allow associate_program_director to update approvals
-- ============================================================
DROP POLICY IF EXISTS "Leadership can approve members" ON profiles;
CREATE POLICY "Leadership can approve members" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      WHERE p1.id = auth.uid()
        AND p1.is_approved = true
        AND p1.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director', 'faculty')
        AND (p1.role = 'admin' OR p1.program_id = profiles.program_id)
    )
  );

-- ============================================================
-- Announcements: allow associate_program_director to manage
-- ============================================================
DROP POLICY IF EXISTS "Leadership can create announcements" ON announcements;
CREATE POLICY "Leadership can create announcements" ON announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
    )
  );

DROP POLICY IF EXISTS "Leadership can update announcements" ON announcements;
CREATE POLICY "Leadership can update announcements" ON announcements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
    )
  );

DROP POLICY IF EXISTS "Leadership can delete announcements" ON announcements;
CREATE POLICY "Leadership can delete announcements" ON announcements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
    )
  );

-- ============================================================
-- Events: allow associate_program_director to manage
-- ============================================================
DROP POLICY IF EXISTS "Leadership can create events" ON events;
CREATE POLICY "Leadership can create events" ON events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
    )
  );

DROP POLICY IF EXISTS "Leadership can update events" ON events;
CREATE POLICY "Leadership can update events" ON events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
    )
  );

DROP POLICY IF EXISTS "Leadership can delete events" ON events;
CREATE POLICY "Leadership can delete events" ON events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
    )
  );

-- ============================================================
-- Schedule weeks: allow associate_program_director to manage
-- ============================================================
DROP POLICY IF EXISTS "Leadership can create schedule weeks" ON schedule_weeks;
CREATE POLICY "Leadership can create schedule weeks" ON schedule_weeks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
        AND (p.role = 'admin' OR p.program_id = schedule_weeks.program_id)
    )
  );

DROP POLICY IF EXISTS "Leadership can update schedule weeks" ON schedule_weeks;
CREATE POLICY "Leadership can update schedule weeks" ON schedule_weeks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
        AND (p.role = 'admin' OR p.program_id = schedule_weeks.program_id)
    )
  );

DROP POLICY IF EXISTS "Leadership can delete schedule weeks" ON schedule_weeks;
CREATE POLICY "Leadership can delete schedule weeks" ON schedule_weeks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
        AND (p.role = 'admin' OR p.program_id = schedule_weeks.program_id)
    )
  );

-- ============================================================
-- Schedule assignments: allow associate_program_director to manage
-- ============================================================
DROP POLICY IF EXISTS "Leadership can manage assignments" ON schedule_assignments;
CREATE POLICY "Leadership can manage assignments" ON schedule_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
    )
  );

-- ============================================================
-- Schedule roles: allow associate_program_director to manage
-- ============================================================
DROP POLICY IF EXISTS "Leadership can manage schedule roles" ON schedule_roles;
CREATE POLICY "Leadership can manage schedule roles" ON schedule_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND p.role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
        AND (p.role = 'admin' OR p.program_id = schedule_roles.program_id)
    )
  );

-- ============================================================
-- Auto-approve trigger: include associate_program_director
-- ============================================================
CREATE OR REPLACE FUNCTION auto_approve_first_program_leader()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_count INT;
  input_code TEXT;
  stored_code TEXT;
BEGIN
  IF NEW.is_profile_complete = true
     AND NEW.role IN ('chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
     AND NEW.program_id IS NOT NULL
     AND NEW.is_approved = false
  THEN
    SELECT COUNT(*) INTO existing_count
    FROM profiles
    WHERE program_id = NEW.program_id
      AND is_approved = true
      AND role IN ('chief_resident', 'program_coordinator', 'program_director', 'associate_program_director', 'admin')
      AND id != NEW.id;

    IF existing_count = 0 THEN
      input_code := NEW.setup_code_input;
      NEW.setup_code_input := NULL;

      IF input_code IS NULL OR input_code = '' THEN
        RETURN NEW;
      END IF;

      SELECT setup_code INTO stored_code
      FROM program_setup_codes
      WHERE program_id = NEW.program_id;

      IF stored_code IS NOT NULL AND UPPER(TRIM(input_code)) = UPPER(TRIM(stored_code)) THEN
        NEW.is_approved := true;
      END IF;
    ELSE
      NEW.setup_code_input := NULL;
    END IF;
  ELSE
    NEW.setup_code_input := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Feedback: allow associate_program_director to view
-- ============================================================
DROP POLICY IF EXISTS "Leadership can view feedback" ON feedback;
CREATE POLICY "Leadership can view feedback" ON feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_approved = true
        AND profiles.role IN ('admin', 'program_director', 'associate_program_director', 'program_coordinator')
    )
  );

-- ============================================================
-- Setup codes: allow associate_program_director to view
-- ============================================================
DROP POLICY IF EXISTS "Leaders can view their program setup code" ON program_setup_codes;
CREATE POLICY "Leaders can view their program setup code" ON program_setup_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_approved = true
        AND (
          p.role = 'admin'
          OR (p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'associate_program_director')
              AND p.program_id = program_setup_codes.program_id)
        )
    )
  );
