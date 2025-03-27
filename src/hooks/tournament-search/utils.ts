
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from "./types";

/**
 * Fetch the status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('id, status, current_players, max_players, tournament_id, ready_check_started_at')
    .eq('id', lobbyId)
    .single();
    
  if (error) {
    console.error("[TOURNAMENT-UI] Error fetching lobby status:", error);
    throw error;
  }
  
  return data;
};

/**
 * Fetch participants for a tournament lobby
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    console.log(`[TOURNAMENT-UI] Fetching participants for lobby ${lobbyId}`);
    
    // Get participants
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, lobby_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (participantsError) {
      console.error("[TOURNAMENT-UI] Error fetching lobby participants:", participantsError);
      throw participantsError;
    }

    if (!participants || participants.length === 0) {
      console.log("[TOURNAMENT-UI] No participants found for lobby");
      return [];
    }
    
    // Extract user IDs
    const userIds = participants.map(p => p.user_id);
    
    // Get profiles separately
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
      
    if (profilesError) {
      console.error("[TOURNAMENT-UI] Error fetching profiles:", profilesError);
      // Return participants with empty profiles rather than failing
      return participants.map(p => ({
        ...p,
        profile: { username: 'Игрок', avatar_url: '' }
      }));
    }
    
    // Combine participants with their profiles
    const participantsWithProfiles = participants.map(participant => {
      const profile = profiles.find(p => p.id === participant.user_id);
      return {
        ...participant,
        profile: profile 
          ? { username: profile.username || 'Игрок', avatar_url: profile.avatar_url || '' }
          : { username: 'Игрок', avatar_url: '' }
      };
    });
    
    console.log(`[TOURNAMENT-UI] Found ${participantsWithProfiles.length} participants`);
    return participantsWithProfiles;
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
    throw error;
  }
};

/**
 * Fetch ready players for a tournament lobby
 */
export const fetchReadyPlayers = async (lobbyId: string) => {
  try {
    const { data, error } = await supabase
      .from('lobby_participants')
      .select('user_id')
      .eq('lobby_id', lobbyId)
      .eq('is_ready', true);
      
    if (error) {
      console.error("[TOURNAMENT-UI] Error fetching ready players:", error);
      throw error;
    }
    
    return data.map(player => player.user_id);
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchReadyPlayers:", error);
    throw error;
  }
};
