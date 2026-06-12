-- Announcements System Migration
-- Allows Chief Residents and Program Directors to post announcements to their program

-- ============================================
-- ANNOUNCEMENTS TABLE
-- ============================================

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for performance
    CONSTRAINT announcements_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
    CONSTRAINT announcements_content_length CHECK (char_length(content) >= 10 AND char_length(content) <= 5000)
);

-- Index for fetching announcements by program (most common query)
CREATE INDEX idx_announcements_program_date ON announcements(program_id, created_at DESC);

-- Index for fetching by author
CREATE INDEX idx_announcements_author ON announcements(author_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone in the program can view announcements
CREATE POLICY "view_program_announcements" ON announcements
    FOR SELECT
    USING (
        program_id IN (
            SELECT program_id
            FROM profiles
            WHERE id = auth.uid()
        )
    );

-- Policy: Chief Residents and Admins can create announcements for their program
CREATE POLICY "create_announcements" ON announcements
    FOR INSERT
    WITH CHECK (
        author_id = auth.uid()
        AND program_id IN (
            SELECT program_id
            FROM profiles
            WHERE id = auth.uid()
            AND is_approved = true
            AND (role = 'chief_resident' OR role = 'admin')
        )
    );

-- Policy: Authors can update their own announcements
CREATE POLICY "update_own_announcements" ON announcements
    FOR UPDATE
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- Policy: Authors and Admins can delete announcements
CREATE POLICY "delete_announcements" ON announcements
    FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND is_approved = true
        )
    );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER announcements_updated_at_trigger
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE announcements IS 'Program announcements posted by Chief Residents and Program Directors';
COMMENT ON COLUMN announcements.program_id IS 'Program the announcement belongs to';
COMMENT ON COLUMN announcements.author_id IS 'Chief Resident or Admin who created the announcement';
COMMENT ON COLUMN announcements.title IS 'Announcement title (3-200 characters)';
COMMENT ON COLUMN announcements.content IS 'Announcement content/body (10-5000 characters)';
