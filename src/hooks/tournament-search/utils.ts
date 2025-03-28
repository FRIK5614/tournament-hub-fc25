
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from "./types";

/**
 * Fetch the current status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  try {
    const { data, error } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players, max_players, ready_check_started_at, tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (error) {
      console.error('[TOURNAMENT-UI] Error fetching lobby status:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in fetchLobbyStatus:', error);
    return null;
  }
};

/**
 * Update the current player count for a lobby
 */
export const updateLobbyPlayerCount = async (lobbyId: string) => {
  try {
    // Count active participants in lobby
    const { data: participants, error: countError } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error('[TOURNAMENT-UI] Error counting lobby participants:', countError);
      return false;
    }
    
    // Update lobby player count
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ 
        current_players: participants?.length || 0 
      })
      .eq('id', lobbyId);
      
    if (updateError) {
      console.error('[TOURNAMENT-UI] Error updating lobby player count:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in updateLobbyPlayerCount:', error);
    return false;
  }
};

/**
 * Fetch all participants in a tournament lobby including their profiles
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    console.log(`[TOURNAMENT-UI] Fetching participants for lobby ${lobbyId}`);
    
    // Step 1: Fetch the lobby participants
    const { data: participants, error } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status, is_ready, lobby_id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error('[TOURNAMENT-UI] Error fetching lobby participants:', error);
      return [];
    }
    
    if (!participants || participants.length === 0) {
      console.log('[TOURNAMENT-UI] No participants found for lobby');
      return [];
    }
    
    // Извлекаем user_ids для запроса профилей
    const userIds = participants.map(p => p.user_id);
    
    // Step 2: Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
      
    if (profilesError) {
      console.error('[TOURNAMENT-UI] Error fetching profiles:', profilesError);
      // Return participants with default profile info
      return participants.map(p => ({
        ...p,
        profile: {
          id: p.user_id,
          username: `Player-${p.user_id.substring(0, 6)}`,
          avatar_url: null
        }
      }));
    }
    
    // Create a map of profiles by user_id for easy lookup
    const profileMap = new Map();
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile);
    });
    
    // Combine participants with their profiles
    const participantsWithProfiles = participants.map(participant => {
      const profile = profileMap.get(participant.user_id) || {
        id: participant.user_id,
        username: `Player-${participant.user_id.substring(0, 6)}`,
        avatar_url: null
      };
      
      return {
        ...participant,
        profile
      };
    });
    
    console.log('[TOURNAMENT-UI] Fetched participants with profiles:', 
      participantsWithProfiles.map(p => ({
        id: p.user_id,
        username: p.profile?.username,
        status: p.status,
        is_ready: p.is_ready
      }))
    );
    
    return participantsWithProfiles;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in fetchLobbyParticipants:', error);
    return [];
  }
};
