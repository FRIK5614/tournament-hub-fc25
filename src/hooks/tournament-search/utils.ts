import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from './types';

/**
 * Fetch the status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string): Promise<{ status: string; tournamentId?: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('tournament_lobbies')
      .select('status, tournament_id')
      .eq('id', lobbyId)
      .single();
      
    if (error) {
      throw error;
    }
    
    return { 
      status: data.status, 
      tournamentId: data.tournament_id 
    };
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error fetching lobby status:", error);
    throw error;
  }
};

/**
 * Fetch participants for a lobby
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    // Get participants without trying to join with profiles
    const { data, error } = await supabase
      .from('lobby_participants')
      .select('id, user_id, lobby_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error("[TOURNAMENT-UI] Error fetching lobby participants:", error);
      throw error;
    }
    
    // Then fetch profiles separately
    const participants: LobbyParticipant[] = [];
    
    for (const participant of data) {
      // Get profile for this user
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', participant.user_id)
        .maybeSingle();
        
      participants.push({
        ...participant,
        profile: profileData || null
      });
    }
    
    return participants;
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error fetching lobby participants:", error);
    throw error;
  }
};

/**
 * Update the current player count for a lobby
 */
export const updateLobbyPlayerCount = async (lobbyId: string) => {
  if (!lobbyId) return;
  
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
      participants?.map(p => ({ id: p.user_id, status: p.status, ready: p.is_ready })));
    
    // Update lobby player count
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
    if (updateError) {
      throw updateError;
    }
    
    // If we have exactly 4 players and lobby status is still 'waiting', update to 'ready_check'
    if (count === 4) {
      const { data: lobbyData } = await supabase
        .from('tournament_lobbies')
        .select('status, tournament_id')
        .eq('id', lobbyId)
        .single();
        
      // Check if lobby has a tournament already - if so, don't mess with the status
      if (lobbyData?.tournament_id) {
        console.log(`[TOURNAMENT] Lobby ${lobbyId} already has tournament ${lobbyData.tournament_id}, skipping status update`);
        return;
      }
        
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
  } catch (error) {
    console.error('[TOURNAMENT] Error updating lobby player count:', error);
  }
};

/**
 * Clean up stale lobbies
 */
export const cleanupStaleLobbies = async () => {
  try {
    // Get all lobbies that are older than 1 hour and still in 'waiting' status
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: staleLobbies, error: staleError } = await supabase
      .from('tournament_lobbies')
      .select('id')
      .eq('status', 'waiting')
      .lt('created_at', oneHourAgo);
      
    if (staleError) {
      console.error('[TOURNAMENT] Error fetching stale lobbies:', staleError);
      return;
    }
    
    if (!staleLobbies || staleLobbies.length === 0) {
      console.log('[TOURNAMENT] No stale lobbies found.');
      return;
    }
    
    console.log(`[TOURNAMENT] Found ${staleLobbies.length} stale lobbies:`, staleLobbies.map(l => l.id));
    
    // For each stale lobby, mark all participants as 'left'
    for (const lobby of staleLobbies) {
      const { error: participantError } = await supabase
        .from('lobby_participants')
        .update({ status: 'left' })
        .eq('lobby_id', lobby.id)
        .in('status', ['searching', 'ready']);
        
      if (participantError) {
        console.error(`[TOURNAMENT] Error cleaning up participants for lobby ${lobby.id}:`, participantError);
        continue;
      }
      
      // Optionally, delete the lobby itself
      const { error: deleteError } = await supabase
        .from('tournament_lobbies')
        .delete()
        .eq('id', lobby.id);
        
      if (deleteError) {
        console.error(`[TOURNAMENT] Error deleting stale lobby ${lobby.id}:`, deleteError);
      } else {
        console.log(`[TOURNAMENT] Deleted stale lobby ${lobby.id}`);
      }
    }
    
    console.log('[TOURNAMENT] Successfully cleaned up stale lobbies and participants.');
  } catch (error) {
    console.error('[TOURNAMENT] Error cleaning up stale lobbies:', error);
  }
};
