import { supabase } from './supabase';
import { Announcement } from '../types';

/**
 * Fetch announcements for the user's program (last 30 days only)
 * Ordered by most recent first
 */
export const fetchProgramAnnouncements = async (): Promise<Announcement[]> => {
  // Calculate date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('announcements')
    .select(`
      *,
      author:profiles!announcements_author_id_fkey(
        id,
        first_name,
        last_name,
        role,
        email
      ),
      program:programs(
        id,
        program_name,
        specialty
      )
    `)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    throw new Error('Failed to fetch announcements');
  }

  return data as Announcement[];
};

/**
 * Create a new announcement
 * Only Chief Residents and Admins can create announcements
 */
export const createAnnouncement = async (
  title: string,
  content: string
): Promise<Announcement> => {
  // Get current user's profile to get program_id and author_id
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('program_id')
    .eq('id', user.id)
    .single();

  if (!profile?.program_id) {
    throw new Error('User does not have a program assigned');
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      program_id: profile.program_id,
      author_id: user.id,
      title: title.trim(),
      content: content.trim(),
    })
    .select(`
      *,
      author:profiles!announcements_author_id_fkey(
        id,
        first_name,
        last_name,
        role,
        email
      ),
      program:programs(
        id,
        program_name,
        specialty
      )
    `)
    .single();

  if (error) {
    console.error('Error creating announcement:', error);
    throw new Error(error.message || 'Failed to create announcement');
  }

  return data as Announcement;
};

/**
 * Update an existing announcement
 * Only the author can update their announcement
 */
export const updateAnnouncement = async (
  announcementId: string,
  title: string,
  content: string
): Promise<Announcement> => {
  const { data, error } = await supabase
    .from('announcements')
    .update({
      title: title.trim(),
      content: content.trim(),
    })
    .eq('id', announcementId)
    .select(`
      *,
      author:profiles!announcements_author_id_fkey(
        id,
        first_name,
        last_name,
        role,
        email
      ),
      program:programs(
        id,
        program_name,
        specialty
      )
    `)
    .single();

  if (error) {
    console.error('Error updating announcement:', error);
    throw new Error('Failed to update announcement');
  }

  return data as Announcement;
};

/**
 * Delete an announcement
 * Only the author or admins can delete
 */
export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);

  if (error) {
    console.error('Error deleting announcement:', error);
    throw new Error('Failed to delete announcement');
  }
};
