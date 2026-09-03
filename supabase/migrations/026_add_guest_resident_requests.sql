-- Guest resident request system
-- Allows programs to request residents from other programs for scheduling

CREATE TYPE guest_request_status AS ENUM ('pending', 'approved', 'declined', 'revoked');

CREATE TABLE program_guest_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requesting_program_id UUID NOT NULL REFERENCES programs(id),
  resident_id UUID NOT NULL REFERENCES profiles(id),
  resident_program_id UUID NOT NULL REFERENCES programs(id),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  status guest_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_programs CHECK (requesting_program_id != resident_program_id),
  CONSTRAINT unique_active_request UNIQUE (requesting_program_id, resident_id)
);

CREATE INDEX idx_guest_requests_requesting ON program_guest_requests(requesting_program_id);
CREATE INDEX idx_guest_requests_resident_program ON program_guest_requests(resident_program_id);
CREATE INDEX idx_guest_requests_resident ON program_guest_requests(resident_id);
CREATE INDEX idx_guest_requests_status ON program_guest_requests(status);

-- RLS policies
ALTER TABLE program_guest_requests ENABLE ROW LEVEL SECURITY;

-- Chiefs/coordinators/directors/admins of either program can view requests
CREATE POLICY "Program leaders can view guest requests"
ON program_guest_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.is_approved = true
    AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
    AND (p.program_id = requesting_program_id OR p.program_id = resident_program_id)
  )
);

-- Chiefs/coordinators/directors/admins of the requesting program can create requests
CREATE POLICY "Program leaders can create guest requests"
ON program_guest_requests FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.is_approved = true
    AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
    AND p.program_id = requesting_program_id
  )
);

-- Chiefs/coordinators/directors/admins of either program can update requests
CREATE POLICY "Program leaders can update guest requests"
ON program_guest_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.is_approved = true
    AND p.role IN ('chief_resident', 'program_coordinator', 'program_director', 'admin')
    AND (p.program_id = requesting_program_id OR p.program_id = resident_program_id)
  )
);

-- Get approved guest residents for a program (used by schedule editor)
CREATE OR REPLACE FUNCTION get_approved_guests(p_program_id UUID)
RETURNS TABLE (
  guest_request_id UUID,
  resident_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  pgy TEXT,
  home_program_name TEXT,
  home_program_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pgr.id AS guest_request_id,
    p.id AS resident_id,
    p.first_name,
    p.last_name,
    p.email,
    p.pgy::TEXT,
    prog.program_name AS home_program_name,
    prog.id AS home_program_id
  FROM program_guest_requests pgr
  JOIN profiles p ON p.id = pgr.resident_id
  JOIN programs prog ON prog.id = pgr.resident_program_id
  WHERE pgr.requesting_program_id = p_program_id
  AND pgr.status = 'approved'
  ORDER BY p.last_name, p.first_name;
END;
$$ LANGUAGE plpgsql;

-- Search residents from other programs (for creating guest requests)
CREATE OR REPLACE FUNCTION search_external_residents(
  p_requesting_program_id UUID,
  p_search_query TEXT
)
RETURNS TABLE (
  resident_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  pgy TEXT,
  program_id UUID,
  program_name TEXT,
  existing_request_status guest_request_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS resident_id,
    p.first_name,
    p.last_name,
    p.email,
    p.pgy::TEXT,
    p.program_id,
    prog.program_name,
    pgr.status AS existing_request_status
  FROM profiles p
  JOIN programs prog ON prog.id = p.program_id
  LEFT JOIN program_guest_requests pgr
    ON pgr.resident_id = p.id
    AND pgr.requesting_program_id = p_requesting_program_id
  WHERE p.program_id != p_requesting_program_id
  AND p.is_approved = true
  AND p.is_profile_complete = true
  AND p.role IN ('resident', 'chief_resident')
  AND p.pgy != 'ALUMNI'
  AND (
    LOWER(p.first_name || ' ' || p.last_name) LIKE '%' || LOWER(p_search_query) || '%'
    OR LOWER(p.email) LIKE '%' || LOWER(p_search_query) || '%'
    OR LOWER(prog.program_name) LIKE '%' || LOWER(p_search_query) || '%'
  )
  ORDER BY p.last_name, p.first_name
  LIMIT 30;
END;
$$ LANGUAGE plpgsql;
