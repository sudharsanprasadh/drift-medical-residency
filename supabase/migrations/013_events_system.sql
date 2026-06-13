-- Events System for Program Management
-- Allows admins, coordinators, and chiefs to create and manage program events

-- ============================================
-- 1. CREATE EVENT TYPE ENUM
-- ============================================
CREATE TYPE event_type AS ENUM (
    'conference',
    'meeting',
    'social',
    'educational',
    'grand_rounds',
    'morning_report',
    'other'
);

CREATE TYPE event_visibility AS ENUM ('public', 'private');

-- ============================================
-- 2. CREATE EVENTS TABLE
-- ============================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Event details
    title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
    description TEXT CHECK (char_length(description) <= 2000),
    event_type event_type NOT NULL DEFAULT 'other',

    -- Date and time
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    duration_minutes INTEGER CHECK (duration_minutes > 0 AND duration_minutes <= 1440), -- max 24 hours

    -- Location
    venue TEXT NOT NULL CHECK (char_length(venue) >= 2 AND char_length(venue) <= 200),

    -- Visibility
    visibility event_visibility NOT NULL DEFAULT 'public',

    -- Contact and notes
    contact_info TEXT CHECK (char_length(contact_info) <= 200),
    notes TEXT CHECK (char_length(notes) <= 1000),

    -- Status
    is_published BOOLEAN NOT NULL DEFAULT true,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================
CREATE INDEX idx_events_program_date ON events(program_id, event_date DESC);
CREATE INDEX idx_events_creator ON events(creator_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_published ON events(is_published, event_date);

-- ============================================
-- 4. CREATE TRIGGERS
-- ============================================
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Events: View published events from your program
CREATE POLICY "Users can view published events from their program" ON events
    FOR SELECT
    USING (
        is_published = true
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = events.program_id
            AND is_approved = true
        )
    );

-- Events: Admins/Coordinators/Chiefs can view all events (including unpublished)
CREATE POLICY "Admins/Coordinators/Chiefs can view all program events" ON events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = events.program_id
            AND role IN ('admin', 'program_coordinator', 'chief_resident')
            AND is_approved = true
        )
    );

-- Events: Admins/Coordinators/Chiefs can create events
CREATE POLICY "Admins/Coordinators/Chiefs can create events" ON events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'program_coordinator', 'chief_resident')
            AND is_approved = true
            AND program_id = events.program_id
        )
    );

-- Events: Admins/Coordinators/Chiefs can update events in their program
CREATE POLICY "Admins/Coordinators/Chiefs can update program events" ON events
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = events.program_id
            AND role IN ('admin', 'program_coordinator', 'chief_resident')
            AND is_approved = true
        )
    );

-- Events: Admins/Coordinators/Chiefs can delete events in their program
CREATE POLICY "Admins/Coordinators/Chiefs can delete program events" ON events
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND program_id = events.program_id
            AND role IN ('admin', 'program_coordinator', 'chief_resident')
            AND is_approved = true
        )
    );

-- ============================================
-- 6. COMMENTS
-- ============================================
COMMENT ON TABLE events IS 'Program events managed by admins, coordinators, and chief residents';
COMMENT ON COLUMN events.visibility IS 'Public events visible to all program members, private only to specific members';
COMMENT ON COLUMN events.event_type IS 'Category of event for filtering and organization';
COMMENT ON COLUMN events.duration_minutes IS 'Expected duration of the event in minutes';
