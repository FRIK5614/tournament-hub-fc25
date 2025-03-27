
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
    
    // Приводим status к типу, определенному в LobbyStatus
    return {
      ...data,
      status: data.status as LobbyStatus['status'] // Приведение типа строки к union типу
    };
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
    // Используем раздельные запросы для участников и профилей
    const { data: participants, error } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error("[TOURNAMENT-UI] Error fetching lobby participants:", error);
      throw error;
    }
    
    // Преобразуем данные в формат LobbyParticipant с пустым профилем
    const lobbyParticipants: LobbyParticipant[] = participants.map(participant => ({
      id: participant.id,
      user_id: participant.user_id,
      lobby_id: lobbyId,
      status: participant.status as LobbyParticipant['status'],
      is_ready: participant.is_ready,
      profile: {
        username: `Player-${participant.user_id.substring(0, 6)}`,
        avatar_url: null
      }
    }));
    
    // Затем попробуем заполнить профили пользователей, если возможно
    try {
      for (const participant of lobbyParticipants) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', participant.user_id)
          .maybeSingle();
        
        if (profile) {
          participant.profile = {
            username: profile.username || `Player-${participant.user_id.substring(0, 6)}`,
            avatar_url: profile.avatar_url
          };
        }
      }
    } catch (profileError) {
      console.error("[TOURNAMENT-UI] Error fetching profiles:", profileError);
      // Продолжаем с дефолтными профилями, если не удалось получить реальные
    }
    
    return lobbyParticipants;
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
