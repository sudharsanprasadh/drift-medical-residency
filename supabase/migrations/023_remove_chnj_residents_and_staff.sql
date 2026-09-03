-- Remove all profiles from Children's Hospital of NJ while keeping the program.
-- Cascading FKs will clean up schedule_assignment_residents,
-- approval_requests, announcements, shift_swap_requests,
-- rotation constraints/tracking, and feedback.

DELETE FROM profiles
WHERE program_id = 'd6110f9d-7883-43a1-84c3-17c9502ad5cd';
