
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from "./types";

/**
 * Fetch the current status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  try {
    const { data, error } = await supabase
      .from('tournament_lobbies')
      .select('id, status, current_players, max_players, ready_check_started_at, tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (error) {
      console.error('[TOURNAMENT-UI] Error fetching lobby status:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Exception in fetchLobbyStatus:', error);
    return null;
  }
};

/**
 * Fetch all participants in a tournament lobby
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    console.log(`[TOURNAMENT-UI] Fetching participants for lobby: ${lobbyId}`);
    
    // Сначала получаем всех участников лобби
    const { data: participants, error } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status, is_ready, lobby_id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error('[TOURNAMENT-UI] Error fetching participants:', error);
      return [];
    }
    
    // Если участников нет, возвращаем пустой массив
    if (!participants || participants.length === 0) {
      return [];
    }
    
    // Формируем массив идентификаторов пользователей для получения их профилей
    const userIds = participants.map(p => p.user_id);
    
    // Получаем профили пользователей отдельным запросом
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    if (profilesError) {
      console.error('[TOURNAMENT-UI] Error fetching profiles:', profilesError);
      // Если не удалось получить профили, создаем минимальные данные на основе user_id
      return participants.map(p => ({
        ...p,
        profile: {
          id: p.user_id,
          username: `Player-${p.user_id.substring(0, 6)}`,
          avatar_url: null
        }
      }));
    }
    
    // Создаем Map для быстрого доступа к профилям по id
    const profilesMap = new Map();
    profiles?.forEach(profile => {
      profilesMap.set(profile.id, profile);
    });
    
    // Объединяем участников с их профилями
    const participantsWithProfiles = participants.map(p => {
      const userProfile = profilesMap.get(p.user_id);
      return {
        ...p,
        profile: userProfile || {
          id: p.user_id,
          username: `Player-${p.user_id.substring(0, 6)}`,
          avatar_url: null
        }
      };
    });
    
    console.log(`[TOURNAMENT-UI] Fetched ${participantsWithProfiles.length} participants with profiles:`, 
      participantsWithProfiles.map(p => ({id: p.user_id, username: p.profile.username}))
    );
    
    return participantsWithProfiles;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Exception in fetchLobbyParticipants:', error);
    return [];
  }
};

/**
 * Update the player count for a lobby based on active participants
 */
export const updateLobbyPlayerCount = async (lobbyId: string) => {
  try {
    console.log(`[TOURNAMENT-UI] Updating player count for lobby: ${lobbyId}`);
    
    // Count active participants
    const { data: participants, error: countError } = await supabase
      .from('lobby_participants')
      .select('id', { count: 'exact' })
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error('[TOURNAMENT-UI] Error counting participants:', countError);
      return false;
    }
    
    const count = participants?.length || 0;
    
    // Update the lobby with the actual count
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
    if (updateError) {
      console.error('[TOURNAMENT-UI] Error updating lobby player count:', updateError);
      return false;
    }
    
    console.log(`[TOURNAMENT-UI] Updated lobby ${lobbyId} player count to ${count}`);
    return true;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Exception in updateLobbyPlayerCount:', error);
    return false;
  }
};
