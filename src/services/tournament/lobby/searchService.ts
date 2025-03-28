
import { supabase } from "@/integrations/supabase/client";
import { delay } from "../utils";
import { updateLobbyPlayerCount as updateLobbyPlayerCountFromUtils } from "@/hooks/tournament-search/utils";

// Helper function for debugging errors in different environments
const logError = (context: string, error: any) => {
  console.error(`[TOURNAMENT] Error in ${context}:`, error);
  
  // In production, add more detail to help diagnose issues
  if (window.location.hostname !== 'localhost') {
    console.error(`[TOURNAMENT] Error details for ${context}:`, {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
  }
};

/**
 * Clean up stale lobby participation to ensure user doesn't have multiple active participations
 */
export const cleanupStaleLobbyParticipation = async (userId: string) => {
  if (!userId) return;
  
  try {
    // Mark all previous participations as 'left'
    const { error } = await supabase
      .from('lobby_participants')
      .update({ status: 'left' })
      .eq('user_id', userId)
      .in('status', ['searching', 'ready']);
      
    if (error) {
      console.error('[TOURNAMENT] Error in cleanupStaleLobbyParticipation:', error);
      return;
    }
      
    console.log(`[TOURNAMENT] Cleaned up stale participations for user ${userId}`);
  } catch (error) {
    console.error('[TOURNAMENT] Error cleaning up stale participations:', error);
  }
};

/**
 * Update the current player count for a lobby
 */
export const updateLobbyPlayerCountLocal = async (lobbyId: string) => {
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
      participants?.map(p => ({ 
        id: p.user_id, 
        status: p.status, 
        ready: p.is_ready 
      }))
    );
    
    // Update lobby player count (без изменения max_players)
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
        .select('status, tournament_id, max_players')
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
 * Search for an available quick tournament or create a new one
 */
export const searchForQuickTournament = async () => {
  try {
    console.log('[TOURNAMENT] Starting search for quick tournament...');
    const { data: user, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[TOURNAMENT] Auth error:', authError);
      throw new Error("Ошибка авторизации: " + authError.message);
    }
    
    if (!user?.user) {
      console.error('[TOURNAMENT] No user found in session');
      throw new Error("Необходимо авторизоваться для участия в турнирах");
    }
    
    console.log('[TOURNAMENT] Current user:', user.user.id);
    
    // Проверяем существующие активные турниры пользователя
    const { data: existingParticipation, error: participationError } = await supabase
      .from('tournament_participants')
      .select('tournament_id(id, status)')
      .eq('user_id', user.user.id)
      .eq('tournament_id.status', 'active')
      .maybeSingle();
    
    if (participationError) {
      console.error('[TOURNAMENT] Error checking existing participation:', participationError);
    }
    
    if (existingParticipation) {
      console.log(`[TOURNAMENT] Пользователь уже участвует в активном турнире: ${existingParticipation.tournament_id.id}`);
      return { lobbyId: existingParticipation.tournament_id.id };
    }
    
    // Очищаем старые lobby участия
    await cleanupStaleLobbyParticipation(user.user.id);
    
    // Используем прямой SQL вызов, чтобы обойти потенциальные проблемы с RPC
    // В случае ошибки с RPC, создаем лобби вручную
    let lobbyId = null;
    
    try {
      // Используем RPC функцию для подбора игроков
      const { data: rpcData, error: rpcError } = await supabase.rpc('match_players_for_quick_tournament');
      
      if (rpcError) {
        console.error('[TOURNAMENT] Error using RPC match_players_for_quick_tournament:', rpcError);
        throw rpcError;
      }
      
      lobbyId = rpcData;
      console.log(`[TOURNAMENT] RPC successfully returned lobby ID: ${lobbyId}`);
    } catch (rpcError) {
      console.error('[TOURNAMENT] Caught RPC error, falling back to manual lobby creation:', rpcError);
      
      // Ручное создание лобби в случае ошибки RPC
      // Ищем существующее лобби с меньше чем 4 игроками
      const { data: existingLobbies } = await supabase
        .from('tournament_lobbies')
        .select('id, current_players')
        .eq('status', 'waiting')
        .lt('current_players', 4)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (existingLobbies && existingLobbies.length > 0) {
        // Используем существующее лобби
        lobbyId = existingLobbies[0].id;
        
        console.log(`[TOURNAMENT] Using existing lobby: ${lobbyId} with ${existingLobbies[0].current_players} players`);
        
        // Обновляем количество игроков
        await supabase
          .from('tournament_lobbies')
          .update({ current_players: existingLobbies[0].current_players + 1 })
          .eq('id', lobbyId);
      } else {
        // Создаем новое лобби
        const { data: newLobby, error: createError } = await supabase
          .from('tournament_lobbies')
          .insert({
            status: 'waiting',
            current_players: 1,
            max_players: 4
          })
          .select('id')
          .single();
        
        if (createError || !newLobby) {
          console.error('[TOURNAMENT] Error creating new lobby:', createError);
          throw new Error("Не удалось создать новое лобби: " + (createError?.message || "неизвестная ошибка"));
        }
        
        lobbyId = newLobby.id;
        console.log(`[TOURNAMENT] Created new lobby: ${lobbyId}`);
      }
    }
    
    if (!lobbyId) {
      console.error('[TOURNAMENT] No lobby ID returned or created');
      throw new Error("Сервер не вернул ID лобби");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} matched to lobby: ${lobbyId}`);
    
    // First check if user already has a profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', user.user.id)
      .maybeSingle();
      
    if (profileError) {
      console.error('[TOURNAMENT] Error fetching profile:', profileError);
    }
    
    if (!profileData) {
      console.log(`[TOURNAMENT] Creating profile for user ${user.user.id}`);
      // Create a profile if one doesn't exist
      const username = user.user.email ? user.user.email.split('@')[0] : `Player-${user.user.id.substring(0, 6)}`;
      await supabase
        .from('profiles')
        .insert({
          id: user.user.id,
          username: username
        });
        
      console.log(`[TOURNAMENT] Created profile with username: ${username}`);
    } else {
      console.log(`[TOURNAMENT] Found existing profile for user ${user.user.id}: ${profileData.username}`);
    }
    
    // Get lobby status and make sure max_players is always 4
    const { data: lobbyData, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players, max_players')
      .eq('id', lobbyId)
      .single();
      
    if (lobbyError) {
      console.error(`[TOURNAMENT] Error fetching lobby data:`, lobbyError);
      throw lobbyError;
    }
    
    // Убедимся, что max_players всегда равно 4
    if (lobbyData?.max_players !== 4) {
      await supabase
        .from('tournament_lobbies')
        .update({ max_players: 4 })
        .eq('id', lobbyId);
      
      console.log(`[TOURNAMENT] Fixed max_players for lobby ${lobbyId} to 4`);
    }
    
    console.log(`[TOURNAMENT] Lobby ${lobbyId} status: ${lobbyData?.status}, players: ${lobbyData?.current_players}/4`);
    
    // If lobby has 4 players but is still in 'waiting' status, update it
    if (lobbyData && lobbyData.current_players === 4 && lobbyData.status === 'waiting') {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} has 4 players but status is 'waiting', updating to 'ready_check'`);
      
      await supabase
        .from('tournament_lobbies')
        .update({ 
          status: 'ready_check',
          ready_check_started_at: new Date().toISOString()
        })
        .eq('id', lobbyId)
        .eq('status', 'waiting')
        .eq('current_players', 4);
    }
      
    const initialStatus = (lobbyData?.status === 'ready_check') ? 'ready' : 'searching';
    console.log(`[TOURNAMENT] Lobby ${lobbyId} has status: ${lobbyData?.status}, setting initial status to: ${initialStatus}`);
    
    // Проверяем, есть ли уже участник в лобби
    const { data: existingParticipant, error: participantError } = await supabase
      .from('lobby_participants')
      .select('id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .maybeSingle();
    
    if (participantError) {
      console.error(`[TOURNAMENT] Error checking existing participation:`, participantError);
    }
    
    // Если участник уже существует, обновляем его статус
    if (existingParticipant) {
      console.log(`[TOURNAMENT] User ${user.user.id} already in lobby ${lobbyId} with status: ${existingParticipant.status}`);
      
      const { error: updateError } = await supabase
        .from('lobby_participants')
        .update({
          status: initialStatus,
          is_ready: false
        })
        .eq('id', existingParticipant.id);
        
      if (updateError) {
        console.error(`[TOURNAMENT] Error updating participant status:`, updateError);
        throw updateError;
      }
    } else {
      // Если участника нет, добавляем его
      console.log(`[TOURNAMENT] Adding user ${user.user.id} to lobby ${lobbyId}`);
      
      const { error: insertError } = await supabase
        .from('lobby_participants')
        .insert({
          lobby_id: lobbyId,
          user_id: user.user.id,
          status: initialStatus,
          is_ready: false
        });
        
      if (insertError) {
        console.error(`[TOURNAMENT] Error inserting participant:`, insertError);
        throw insertError;
      }
    }
    
    // Принудительно обновляем количество игроков в лобби
    await updateLobbyPlayerCountLocal(lobbyId);
    
    // Добавляем небольшую задержку и проверяем, что игрок был добавлен корректно
    await delay(500);
    
    const { data: verifyParticipant } = await supabase
      .from('lobby_participants')
      .select('id, status')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .single();
      
    if (!verifyParticipant) {
      console.error(`[TOURNAMENT] Player was not added to lobby after verification!`);
      
      // Try one more time to add player
      const { error: retryError } = await supabase
        .from('lobby_participants')
        .insert({
          lobby_id: lobbyId,
          user_id: user.user.id,
          status: initialStatus,
          is_ready: false
        });
        
      if (retryError) {
        console.error(`[TOURNAMENT] Error in final retry for adding participant:`, retryError);
      }
    }
    
    // Make sure to get the latest participant count
    await updateLobbyPlayerCountLocal(lobbyId);
    
    // Let's query all participants to log them
    const { data: allParticipants } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    console.log(`[TOURNAMENT] Lobby ${lobbyId} participants after user added:`, allParticipants);
    
    return { lobbyId };
  } catch (error) {
    logError("searchForQuickTournament", error);
    throw error;
  }
};

/**
 * Leave a quick tournament lobby
 */
export const leaveQuickTournament = async (lobbyId: string) => {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error("Пользователь не авторизован");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} leaving lobby ${lobbyId}`);
    
    // Очищаем данные о лобби в localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tournament_lobby_id');
      localStorage.removeItem('tournament_search_state');
    }
    
    // Mark player as having left
    await supabase
      .from('lobby_participants')
      .update({ status: 'left' })
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id);
      
    // Update lobby player count
    await updateLobbyPlayerCountLocal(lobbyId);
    
    // Если лобби было в статусе 'ready_check', сбрасываем его до 'waiting'
    const { data: lobby } = await supabase
      .from('tournament_lobbies')
      .select('status')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (lobby && lobby.status === 'ready_check') {
      console.log(`[TOURNAMENT] Resetting lobby ${lobbyId} from ready_check to waiting`);
      
      await supabase
        .from('tournament_lobbies')
        .update({ 
          status: 'waiting', 
          ready_check_started_at: null 
        })
        .eq('id', lobbyId)
        .eq('status', 'ready_check');
        
      // Сбрасываем флаги готовности всех игроков
      await supabase
        .from('lobby_participants')
        .update({ is_ready: false })
        .eq('lobby_id', lobbyId);
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} successfully left lobby ${lobbyId}`);
    return { success: true };
  } catch (error) {
    logError("leaveQuickTournament", error);
    throw error;
  }
};
