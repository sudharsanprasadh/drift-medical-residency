-- Fix RLS policies for approval_requests to include all leadership roles
-- Currently only chief_resident can view/manage approvals
-- This expands it to: chief_resident, program_coordinator, program_director, faculty

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Chiefs can view program approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Admins and Chiefs can update approvals" ON approval_requests;

-- Create new policy that includes all leadership roles
CREATE POLICY "Leadership can view program approval requests" ON approval_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p1
            JOIN profiles p2 ON p1.program_id = p2.program_id
            WHERE p1.id = auth.uid()
            AND p1.role IN ('chief_resident', 'program_coordinator', 'program_director', 'faculty', 'admin')
            AND p1.is_approved = true
            AND p2.id = approval_requests.user_id
        )
    );

-- Leadership can update approval requests
CREATE POLICY "Leadership can update approvals" ON approval_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'chief_resident', 'program_coordinator', 'program_director', 'faculty')
            AND is_approved = true
        )
    );

-- Add helpful comment
COMMENT ON POLICY "Leadership can view program approval requests" ON approval_requests IS
'Allows all leadership roles (chiefs, coordinators, directors, faculty, admins) to view approval requests from their program';

COMMENT ON POLICY "Leadership can update approvals" ON approval_requests IS
'Allows all leadership roles to approve or reject user registration requests';
