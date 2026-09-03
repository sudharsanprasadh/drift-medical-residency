-- Add has_day_shift and has_night_shift columns to schedule_roles
-- These allow roles to omit unused shift periods from the schedule grid

ALTER TABLE schedule_roles
ADD COLUMN has_day_shift BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN has_night_shift BOOLEAN NOT NULL DEFAULT TRUE;
