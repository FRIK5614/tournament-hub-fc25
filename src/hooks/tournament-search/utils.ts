
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from './types';

/**
 * Fetch the current status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  try {
    const { data, error } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players, tournament_id, ready_check_started_at')
      .eq('id', lobbyId)
      .single();
      
    if (error) {
      console.error("[TOURNAMENT-UI] Error fetching lobby status:", error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyStatus:", error);
    throw error;
  }
};

/**
 * Fetch participants in a lobby
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    console.log("[TOURNAMENT-UI] Fetching participants for lobby:", lobbyId);
    
    // Fetch basic participant data
    const { data, error } = await supabase
      .from('lobby_participants')
      .select('id, user_id, lobby_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error("[TOURNAMENT-UI] Error fetching lobby participants:", error);
      throw error;
    }
    
    console.log("[TOURNAMENT-UI] Found", data.length, "participants in lobby");
    
    if (data.length === 0) {
      return [];
    }
    
    // Fetch profile data for all participants
    const userIds = data.map(p => p.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
      
    if (profileError) {
      console.error("[TOURNAMENT-UI] Error fetching participant profiles:", profileError);
      throw profileError;
    }
    
    console.log("[TOURNAMENT-UI] Fetched", profiles?.length, "profiles for participants");
    
    // Combine participant data with profile data
    const participantsWithProfiles = data.map(participant => {
      const profile = profiles?.find(p => p.id === participant.user_id);
      return {
        ...participant,
        profile,
        status: participant.status as "searching" | "ready" | "left"
      };
    }) as LobbyParticipant[];
    
    console.log("[TOURNAMENT-UI] Participants with profiles:", participantsWithProfiles);
    console.log("[TOURNAMENT-UI] Fetched participants:", participantsWithProfiles);
    
    return participantsWithProfiles;
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
    throw error;
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
      .select('id, user_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      throw countError;
    }
    
    const count = participants?.length || 0;
    console.log(`[TOURNAMENT] Lobby ${lobbyId} has ${count} active participants:`, 
      participants?.map(p => ({ 
        id: p.user_id, 
        status: p.status, 
        ready: p.is_ready 
      }))
    );
    
    // Update lobby player count
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
    if (updateError) {
      throw updateError;
    }
    
    // Check if we need to update status to ready_check
    if (count === 4) {
      const { data: lobbyData } = await supabase
        .from('tournament_lobbies')
        .select('status')
        .eq('id', lobbyId)
        .single();
        
      if (lobbyData?.status === 'waiting') {
        console.log(`[TOURNAMENT] Lobby ${lobbyId} has 4 players, updating to ready_check`);
        
        await supabase
          .from('tournament_lobbies')
          .update({ 
            status: 'ready_check', 
            ready_check_started_at: new Date().toISOString() 
          })
          .eq('id', lobbyId)
          .eq('status', 'waiting');
      }
    }
    
    console.log(`[TOURNAMENT] Updated lobby ${lobbyId} player count to ${count}`);
    return count;
  } catch (error) {
    console.error('[TOURNAMENT] Error updating lobby player count:', error);
    throw error;
  }
};
