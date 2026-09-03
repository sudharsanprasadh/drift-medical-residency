-- Add shift timing fields to schedule_roles
-- These define the start and end times for each shift type per role

ALTER TABLE schedule_roles
ADD COLUMN day_shift_start_time TEXT DEFAULT '07:00',
ADD COLUMN day_shift_end_time TEXT DEFAULT '19:00',
ADD COLUMN night_shift_start_time TEXT DEFAULT '19:00',
ADD COLUMN night_shift_end_time TEXT DEFAULT '07:00';

-- Helper function to calculate hours between two HH:MM times, handling midnight crossing
CREATE OR REPLACE FUNCTION calc_shift_hours(start_time TEXT, end_time TEXT)
RETURNS DECIMAL AS $$
DECLARE
  start_minutes INTEGER;
  end_minutes INTEGER;
  diff INTEGER;
BEGIN
  IF start_time IS NULL OR end_time IS NULL THEN
    RETURN 12.0;
  END IF;
  start_minutes := (SPLIT_PART(start_time, ':', 1)::INTEGER * 60)
                 + SPLIT_PART(start_time, ':', 2)::INTEGER;
  end_minutes   := (SPLIT_PART(end_time, ':', 1)::INTEGER * 60)
                 + SPLIT_PART(end_time, ':', 2)::INTEGER;
  diff := end_minutes - start_minutes;
  IF diff <= 0 THEN
    diff := diff + 1440;
  END IF;
  RETURN (diff / 60.0)::DECIMAL(5,2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Replace calculate_resident_duty_hours to use actual shift timings from roles
CREATE OR REPLACE FUNCTION calculate_resident_duty_hours(
    p_resident_id UUID,
    p_week_id UUID
)
RETURNS TABLE (
    total_hours DECIMAL,
    day_shift_hours DECIMAL,
    night_shift_hours DECIMAL,
    total_shifts INTEGER,
    day_shifts INTEGER,
    night_shifts INTEGER,
    days_off_count INTEGER,
    weekend_shifts INTEGER
) AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
BEGIN
    SELECT start_date, end_date INTO v_week_start, v_week_end
    FROM schedule_weeks WHERE id = p_week_id;

    RETURN QUERY
    SELECT
        COALESCE(SUM(
            CASE
                WHEN sa.shift_period = 'day' THEN
                    calc_shift_hours(sr.day_shift_start_time, sr.day_shift_end_time)
                WHEN sa.shift_period = 'night' THEN
                    calc_shift_hours(sr.night_shift_start_time, sr.night_shift_end_time)
                WHEN sa.shift_period = 'day_night' THEN
                    calc_shift_hours(sr.day_shift_start_time, sr.day_shift_end_time)
                    + calc_shift_hours(sr.night_shift_start_time, sr.night_shift_end_time)
                ELSE 12.0
            END
        ), 0)::DECIMAL AS total_hours,
        COALESCE(SUM(
            CASE WHEN sa.shift_period IN ('day', 'day_night') THEN
                calc_shift_hours(sr.day_shift_start_time, sr.day_shift_end_time)
            ELSE 0 END
        ), 0)::DECIMAL AS day_shift_hours,
        COALESCE(SUM(
            CASE WHEN sa.shift_period IN ('night', 'day_night') THEN
                calc_shift_hours(sr.night_shift_start_time, sr.night_shift_end_time)
            ELSE 0 END
        ), 0)::DECIMAL AS night_shift_hours,
        COALESCE(COUNT(*)::INTEGER, 0) AS total_shifts,
        COALESCE(COUNT(*) FILTER (WHERE sa.shift_period IN ('day', 'day_night'))::INTEGER, 0) AS day_shifts,
        COALESCE(COUNT(*) FILTER (WHERE sa.shift_period IN ('night', 'day_night'))::INTEGER, 0) AS night_shifts,
        (7 - COALESCE(COUNT(DISTINCT sa.shift_date)::INTEGER, 0)) AS days_off_count,
        COALESCE(COUNT(*) FILTER (WHERE EXTRACT(DOW FROM sa.shift_date) IN (0, 6))::INTEGER, 0) AS weekend_shifts
    FROM schedule_assignment_residents sar
    JOIN schedule_assignments sa ON sa.id = sar.assignment_id
    JOIN schedule_roles sr ON sr.id = sa.role_id
    WHERE sar.resident_id = p_resident_id
    AND sar.is_backup = false
    AND sa.schedule_week_id = p_week_id;
END;
$$ LANGUAGE plpgsql;

-- RPC to get per-resident per-role hours aggregation
CREATE OR REPLACE FUNCTION get_resident_role_hours(
    p_resident_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    role_id UUID,
    role_name TEXT,
    total_shifts BIGINT,
    day_shifts BIGINT,
    night_shifts BIGINT,
    total_hours DECIMAL,
    day_shift_hours DECIMAL,
    night_shift_hours DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sr.id AS role_id,
        sr.role_name,
        COUNT(*)::BIGINT AS total_shifts,
        COUNT(*) FILTER (WHERE sa.shift_period IN ('day', 'day_night'))::BIGINT AS day_shifts,
        COUNT(*) FILTER (WHERE sa.shift_period IN ('night', 'day_night'))::BIGINT AS night_shifts,
        COALESCE(SUM(
            CASE
                WHEN sa.shift_period = 'day' THEN
                    calc_shift_hours(sr.day_shift_start_time, sr.day_shift_end_time)
                WHEN sa.shift_period = 'night' THEN
                    calc_shift_hours(sr.night_shift_start_time, sr.night_shift_end_time)
                WHEN sa.shift_period = 'day_night' THEN
                    calc_shift_hours(sr.day_shift_start_time, sr.day_shift_end_time)
                    + calc_shift_hours(sr.night_shift_start_time, sr.night_shift_end_time)
                ELSE 12.0
            END
        ), 0)::DECIMAL AS total_hours,
        COALESCE(SUM(
            CASE WHEN sa.shift_period IN ('day', 'day_night') THEN
                calc_shift_hours(sr.day_shift_start_time, sr.day_shift_end_time)
            ELSE 0 END
        ), 0)::DECIMAL AS day_shift_hours,
        COALESCE(SUM(
            CASE WHEN sa.shift_period IN ('night', 'day_night') THEN
                calc_shift_hours(sr.night_shift_start_time, sr.night_shift_end_time)
            ELSE 0 END
        ), 0)::DECIMAL AS night_shift_hours
    FROM schedule_assignment_residents sar
    JOIN schedule_assignments sa ON sa.id = sar.assignment_id
    JOIN schedule_roles sr ON sr.id = sa.role_id
    WHERE sar.resident_id = p_resident_id
    AND sar.is_backup = false
    AND (p_start_date IS NULL OR sa.shift_date >= p_start_date)
    AND (p_end_date IS NULL OR sa.shift_date <= p_end_date)
    GROUP BY sr.id, sr.role_name
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;
