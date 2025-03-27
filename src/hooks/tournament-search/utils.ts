
import { LobbyParticipant } from './types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Ensure all participants have the correct status during ready check
 */
export const ensureParticipantStatus = async (
  participants: LobbyParticipant[],
  lobbyId: string
): Promise<void> => {
  if (!lobbyId || !participants.length) {
    return;
  }

  try {
    // Find participants in 'searching' status
    const searchingParticipants = participants.filter(p => p.status === 'searching');
    
    if (searchingParticipants.length > 0) {
      console.log(`[TOURNAMENT-UI] Updating ${searchingParticipants.length} participants from 'searching' to 'ready' status`);

      // Update each participant status to 'ready'
      for (const participant of searchingParticipants) {
        await supabase
          .from('lobby_participants')
          .update({ status: 'ready' })
          .eq('lobby_id', lobbyId)
          .eq('user_id', participant.user_id);
      }
    }
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in ensureParticipantStatus:', error);
  }
};

/**
 * Fetch lobby status from the database
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  if (!lobbyId) {
    throw new Error('Lobby ID is required');
  }

  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('status, current_players, ready_check_started_at, tournament_id')
    .eq('id', lobbyId)
    .single();

  if (error) {
    console.error('[TOURNAMENT-UI] Error fetching lobby status:', error);
    throw error;
  }

  return data;
};

/**
 * Fetch lobby participants from the database
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  if (!lobbyId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('lobby_participants')
      .select(`
        id,
        user_id,
        lobby_id,
        status,
        is_ready,
        profile:profiles(id, username, avatar_url)
      `)
      .eq('lobby_id', lobbyId);

    if (error) {
      console.error('[TOURNAMENT-UI] Error fetching lobby participants:', error);
      throw error;
    }

    // Enhance with missing profile data if needed
    const enhancedParticipants = await enrichParticipantsWithProfiles(data || []);
    
    // Convert to LobbyParticipant format
    return parseLobbyParticipants(enhancedParticipants);
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in fetchLobbyParticipants:', error);
    return [];
  }
};

/**
 * Handle missing profile data in participant list
 */
export const enrichParticipantsWithProfiles = async (
  participants: any[]
): Promise<any[]> => {
  if (!participants.length) {
    return [];
  }

  // Find participants missing profile data
  const missingProfiles = participants.filter(p => !p.profile);
  
  if (missingProfiles.length > 0) {
    const userIds = missingProfiles.map(p => p.user_id);
    
    try {
      // Fetch profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
        
      if (profiles) {
        // Create a map of userId -> profile
        const profileMap = new Map();
        profiles.forEach(profile => {
          profileMap.set(profile.id, profile);
        });
        
        // Enrich participants with profile data
        return participants.map(p => {
          if (!p.profile && profileMap.has(p.user_id)) {
            return { ...p, profile: profileMap.get(p.user_id) };
          }
          return p;
        });
      }
    } catch (error) {
      console.error('[TOURNAMENT-UI] Error enriching participants with profiles:', error);
    }
  }
  
  return participants;
};

/**
 * Convert database participant entries to LobbyParticipant objects
 */
export const parseLobbyParticipants = (data: any[]): LobbyParticipant[] => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  return data.map(item => ({
    id: item.id,
    user_id: item.user_id,
    lobby_id: item.lobby_id || '', // Ensure lobby_id is always present
    status: item.status || 'searching',
    is_ready: item.is_ready || false,
    profile: item.profile || null
  }));
};

/**
 * Update lobby player count to ensure accuracy
 */
export const updateLobbyPlayerCount = async (lobbyId: string): Promise<void> => {
  if (!lobbyId) return;
  
  try {
    // Count active participants
    const { data, error } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error('[TOURNAMENT-UI] Error counting lobby participants:', error);
      return;
    }
    
    const count = data?.length || 0;
    
    // Update lobby current_players count
    await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
    console.log(`[TOURNAMENT-UI] Updated lobby ${lobbyId} player count to ${count}`);
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error updating lobby player count:', error);
  }
};
