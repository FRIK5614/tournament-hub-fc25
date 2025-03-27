
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from "./types";

/**
 * Fetch the status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('status, current_players, max_players, tournament_id')
    .eq('id', lobbyId)
    .single();
    
  if (error) {
    console.error('[TOURNAMENT-UI] Error fetching lobby status:', error);
    throw error;
  }
  
  return data;
};

/**
 * Fetch participants in a tournament lobby
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  const { data, error } = await supabase
    .from('lobby_participants')
    .select(`
      id, 
      user_id, 
      status, 
      is_ready,
      profile:profiles(id, username, avatar_url)
    `)
    .eq('lobby_id', lobbyId)
    .in('status', ['searching', 'ready']);
    
  if (error) {
    console.error('[TOURNAMENT-UI] Error fetching lobby participants:', error);
    throw error;
  }
  
  return data || [];
};

/**
 * Update the current player count for a lobby
 */
export const updateLobbyPlayerCount = async (lobbyId: string) => {
  const { data: participants, error: countError } = await supabase
    .from('lobby_participants')
    .select('id')
    .eq('lobby_id', lobbyId)
    .in('status', ['searching', 'ready']);
    
  if (countError) {
    console.error('[TOURNAMENT-UI] Error counting participants:', countError);
    return;
  }
  
  const count = participants?.length || 0;
  
  await supabase
    .from('tournament_lobbies')
    .update({ current_players: count })
    .eq('id', lobbyId);
    
  console.log(`[TOURNAMENT-UI] Updated lobby ${lobbyId} player count to ${count}`);
  
  // If we have 4 players, check if we need to update status to ready_check
  if (count === 4) {
    const { data: lobby } = await supabase
      .from('tournament_lobbies')
      .select('status')
      .eq('id', lobbyId)
      .single();
      
    if (lobby?.status === 'waiting') {
      console.log(`[TOURNAMENT-UI] Lobby ${lobbyId} has 4 players, updating to ready_check`);
      
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
};
