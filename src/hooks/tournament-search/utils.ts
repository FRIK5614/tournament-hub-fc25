
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant, LobbyStatus } from "./types";

/**
 * Fetch the current status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string): Promise<LobbyStatus> => {
  try {
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
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyStatus:", error);
    throw error;
  }
};

/**
 * Fetch participants of a tournament lobby with their profiles
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    const { data, error } = await supabase
      .from('lobby_participants')
      .select(`
        id, 
        user_id, 
        status, 
        is_ready,
        profile:user_id (
          username,
          avatar_url
        )
      `)
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error("[TOURNAMENT-UI] Error fetching lobby participants:", error);
      throw error;
    }
    
    // Преобразуем данные в формат LobbyParticipant, добавляя lobby_id
    return data.map(participant => ({
      id: participant.id,
      user_id: participant.user_id,
      lobby_id: lobbyId, // Добавляем lobby_id, которого не было в исходном запросе
      status: participant.status,
      is_ready: participant.is_ready,
      profile: participant.profile || null
    }));
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
    throw error;
  }
};

/**
 * Update the player count in a tournament lobby
 */
export const updateLobbyPlayerCount = async (lobbyId: string): Promise<void> => {
  try {
    // Получаем текущее количество активных участников
    const { data: participants, error } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error("[TOURNAMENT-UI] Error counting participants:", error);
      throw error;
    }
    
    const count = participants?.length || 0;
    
    // Обновляем счетчик игроков в лобби
    await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in updateLobbyPlayerCount:", error);
    throw error;
  }
};
