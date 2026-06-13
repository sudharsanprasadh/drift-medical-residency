import { supabase } from './supabase';
import { Event, EventType, EventVisibility } from '../types';

/**
 * Fetch all published events for the user's program
 */
export const fetchProgramEvents = async (): Promise<Event[]> => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(
        id,
        first_name,
        last_name,
        role
      ),
      program:programs(*)
    `)
    .eq('is_published', true)
    .eq('is_cancelled', false)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Fetch all events (including unpublished) for admins/coordinators/chiefs
 */
export const fetchAllProgramEvents = async (): Promise<Event[]> => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(
        id,
        first_name,
        last_name,
        role
      ),
      program:programs(*)
    `)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Fetch a single event by ID
 */
export const fetchEvent = async (eventId: string): Promise<Event> => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(
        id,
        first_name,
        last_name,
        role
      ),
      program:programs(*)
    `)
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Create a new event
 */
export const createEvent = async (eventData: {
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string;
  event_time: string;
  duration_minutes: number | null;
  venue: string;
  visibility: EventVisibility;
  contact_info: string | null;
  notes: string | null;
  is_published: boolean;
  program_id: string;
  creator_id: string;
}): Promise<Event> => {
  const { data, error } = await supabase
    .from('events')
    .insert(eventData)
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(
        id,
        first_name,
        last_name,
        role
      ),
      program:programs(*)
    `)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update an existing event
 */
export const updateEvent = async (
  eventId: string,
  updates: {
    title?: string;
    description?: string | null;
    event_type?: EventType;
    event_date?: string;
    event_time?: string;
    duration_minutes?: number | null;
    venue?: string;
    visibility?: EventVisibility;
    contact_info?: string | null;
    notes?: string | null;
    is_published?: boolean;
    is_cancelled?: boolean;
  }
): Promise<Event> => {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(
        id,
        first_name,
        last_name,
        role
      ),
      program:programs(*)
    `)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete an event
 */
export const deleteEvent = async (eventId: string): Promise<void> => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
};

/**
 * Cancel an event (soft delete)
 */
export const cancelEvent = async (eventId: string): Promise<Event> => {
  return updateEvent(eventId, { is_cancelled: true });
};
