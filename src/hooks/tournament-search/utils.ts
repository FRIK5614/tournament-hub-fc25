
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from "./types";

export const fetchLobbyStatus = async (lobbyId: string) => {
  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('status, current_players, tournament_id, ready_check_started_at')
    .eq('id', lobbyId)
    .single();
    
  if (error) {
    console.error('Error fetching lobby status:', error);
    throw error;
  }
  
  return data;
};

export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  console.log(`[TOURNAMENT-UI] Fetching participants for lobby: ${lobbyId}`);
  
  // Получаем список участников лобби
  const { data: participants, error } = await supabase
    .from('lobby_participants')
    .select('id, user_id, lobby_id, status, is_ready')
    .eq('lobby_id', lobbyId)
    .in('status', ['searching', 'ready']);
    
  if (error) {
    console.error('Error fetching lobby participants:', error);
    throw error;
  }
  
  if (!participants || participants.length === 0) {
    console.log('[TOURNAMENT-UI] No participants found in lobby');
    return [];
  }
  
  console.log(`[TOURNAMENT-UI] Found ${participants.length} participants in lobby`);
  
  // Получаем ID всех пользователей для запроса профилей
  const userIds = participants.map(p => p.user_id);
  
  // Получаем профили пользователей
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
    
  if (profilesError) {
    console.error('Error fetching participant profiles:', profilesError);
    // В случае ошибки продолжаем без профилей
  }
  
  console.log(`[TOURNAMENT-UI] Fetched ${profiles?.length || 0} profiles for participants`);
  
  // Объединяем данные участников с их профилями и явно указываем тип
  const participantsWithProfiles: LobbyParticipant[] = participants.map(participant => {
    const profile = profiles ? profiles.find(p => p.id === participant.user_id) : null;
    return {
      ...participant,
      // Убеждаемся, что status имеет правильный тип
      status: participant.status as 'searching' | 'ready' | 'left',
      profile: profile || null
    };
  });
  
  console.log('[TOURNAMENT-UI] Participants with profiles:', participantsWithProfiles);
  
  return participantsWithProfiles;
};

export const updateLobbyPlayerCount = async (lobbyId: string): Promise<number> => {
  try {
    // Получаем количество активных участников
    const { data: participants, error: countError } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error('Error counting participants:', countError);
      return 0;
    }
    
    const count = participants?.length || 0;
    
    // Обновляем количество игроков в лобби
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
    if (updateError) {
      console.error('Error updating player count:', updateError);
    }
    
    return count;
  } catch (error) {
    console.error('Error in updateLobbyPlayerCount:', error);
    return 0;
  }
};
