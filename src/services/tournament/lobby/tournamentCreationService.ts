
import { supabase } from "@/integrations/supabase/client";
import { withRetry, delay } from "../utils";

/**
 * Create a tournament for a lobby by calling the RPC function
 */
export const createTournamentViaRPC = async (lobbyId: string) => {
  try {
    // Проверяем авторизацию
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("[TOURNAMENT] Authentication error:", authError);
      throw new Error("Убедитесь, что вы авторизованы для создания турнира");
    }

    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, max_players, status, current_players')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (existingLobby?.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists: ${existingLobby.tournament_id}`);
      return { tournamentId: existingLobby.tournament_id, created: false };
    }
    
    // Проверяем, что max_players = 4
    if (existingLobby && existingLobby.max_players !== 4) {
      console.log(`[TOURNAMENT] Fixing max_players for lobby ${lobbyId} to 4`);
      await supabase
        .from('tournament_lobbies')
        .update({ max_players: 4 })
        .eq('id', lobbyId);
    }
    
    // Проверяем количество игроков в лобби непосредственно в базе данных
    const { data: participantCount, error: countError } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error checking participant count:", countError);
    }
    
    const actualPlayerCount = participantCount ? participantCount.length : 0;
    console.log(`[TOURNAMENT] Actual player count in database: ${actualPlayerCount}/4`);
    
    if (actualPlayerCount < 4) {
      throw new Error(`Недостаточно игроков для создания турнира: ${actualPlayerCount}/4`);
    }
    
    console.log(`[TOURNAMENT] Attempting to create tournament via RPC as user ${authData.user.id}`);
    
    // Before creating, double-check the ready status of all participants
    const { data: participants, error: participantsCheckError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status, profile:profiles(id, username, avatar_url)')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready', 'searching']);  // Включаем и searching статус
      
    if (participantsCheckError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsCheckError);
      throw participantsCheckError;
    }
    
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    // Обновляем статус ВСЕХ игроков на ready
    try {
      console.log("[TOURNAMENT] Setting all participants to ready status...");
      const { error: updateError } = await supabase
        .from('lobby_participants')
        .update({ 
          is_ready: true,
          status: 'ready'
        })
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
        
      if (updateError) {
        console.error("[TOURNAMENT] Error updating participants status:", updateError);
      } else {
        console.log("[TOURNAMENT] Successfully updated participants status to ready");
      }
    } catch (updateError) {
      console.error("[TOURNAMENT] Error in update operation:", updateError);
    }
    
    // Получаем обновленный список участников после изменения статуса
    const { data: updatedParticipants, error: updatedParticipantsError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status, profile:profiles(id, username, avatar_url)')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready']);
      
    if (updatedParticipantsError) {
      console.error("[TOURNAMENT] Error checking updated participants:", updatedParticipantsError);
    }
    
    const readyCount = updatedParticipants?.filter(p => p.is_ready)?.length || 0;
    
    console.log(`[TOURNAMENT] Ready count after update: ${readyCount}/${updatedParticipants?.length || 0}`);
    
    // Защита от RLS ошибок - проверяем, что текущий пользователь является участником лобби
    const currentUserIsParticipant = participants.some(p => p.user_id === authData.user.id);
    if (!currentUserIsParticipant) {
      console.error("[TOURNAMENT] Current user is not part of the lobby - possible RLS violation");
      
      // Попытка добавить текущего пользователя в лобби
      try {
        console.log("[TOURNAMENT] Attempting to add current user to lobby");
        const { error: joinError } = await supabase
          .from('lobby_participants')
          .insert({
            lobby_id: lobbyId,
            user_id: authData.user.id,
            status: 'ready',
            is_ready: true
          });
          
        if (joinError) {
          console.error("[TOURNAMENT] Error adding current user to lobby:", joinError);
          throw new Error("У вас нет прав для создания турнира в этом лобби и не удалось добавить вас в лобби");
        }
        
        console.log("[TOURNAMENT] Successfully added current user to lobby");
      } catch (joinError) {
        console.error("[TOURNAMENT] Error joining lobby:", joinError);
        throw new Error("У вас нет прав для создания турнира в этом лобби");
      }
    }
    
    // Пробуем выполнить RPC с особой обработкой ошибок RLS
    console.log("[TOURNAMENT] Using RPC to create tournament matches");
    
    try {
      // Следующий подход: попробуем использовать RPC, но с админ-ключом
      console.log("[TOURNAMENT] First trying with standard permissions");
      
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_matches_for_quick_tournament', {
        lobby_id: lobbyId
      });
      
      if (rpcError) {
        // Тут ошибка RLS - но это ожидаемо. Переключаемся на ручной метод
        console.error("[TOURNAMENT] RPC error details:", rpcError);
        throw new Error("RPC error - switching to manual method");
      }
      
      console.log(`[TOURNAMENT] RPC execution successful:`, rpcData);
    } catch (rpcInnerError) {
      // Если RPC не удалось, переходим к ручному методу
      console.error("[TOURNAMENT] Inner RPC error - switching to manual creation:", rpcInnerError);
      return await createTournamentManually(lobbyId);
    }
    
    // Если мы здесь, то RPC метод может быть успешным, проверяем
    const { data: updatedLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (!updatedLobby?.tournament_id) {
      console.log("[TOURNAMENT] Tournament not created by RPC, switching to manual creation");
      return await createTournamentManually(lobbyId);
    }
    
    console.log(`[TOURNAMENT] Tournament created via RPC: ${updatedLobby.tournament_id}`);
    return { tournamentId: updatedLobby.tournament_id, created: true };
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentViaRPC:", error);
    // В случае ошибки в RPC методе, пробуем ручной метод
    try {
      return await createTournamentManually(lobbyId);
    } catch (manualError) {
      console.error("[TOURNAMENT] Manual creation also failed:", manualError);
      throw manualError;
    }
  }
};

/**
 * Create a tournament manually when RPC fails
 */
export const createTournamentManually = async (lobbyId: string) => {
  try {
    // Проверяем авторизацию
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("[TOURNAMENT] Authentication error:", authError);
      throw new Error("Убедитесь, что вы авторизованы для создания турнира");
    }

    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, max_players, status, current_players')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (existingLobby?.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists: ${existingLobby.tournament_id}`);
      return { tournamentId: existingLobby.tournament_id, created: false };
    }
    
    // Проверяем количество игроков в лобби непосредственно в базе данных
    const { data: participantCount, error: countError } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error checking participant count:", countError);
    }
    
    const actualPlayerCount = participantCount ? participantCount.length : 0;
    console.log(`[TOURNAMENT] Manual creation - Actual player count: ${actualPlayerCount}/4`);
    
    if (actualPlayerCount < 4) {
      throw new Error(`Недостаточно игроков для создания турнира: ${actualPlayerCount}/4`);
    }
    
    console.log(`[TOURNAMENT] Creating tournament manually as user ${authData.user.id}`);
    
    // Force update all participants to ready status
    try {
      console.log("[TOURNAMENT] Setting all participants to ready status");
      await supabase
        .from('lobby_participants')
        .update({ 
          is_ready: true, 
          status: 'ready' 
        })
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
    } catch (updateError) {
      console.error("[TOURNAMENT] Error updating participant status:", updateError);
    }
    
    // After update, fetch all participants
    const { data: participants, error: participantsCheckError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status, profile:profiles(id, username, avatar_url)')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready']);
      
    if (participantsCheckError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsCheckError);
      throw participantsCheckError;
    }
    
    // Проверяем, есть ли достаточно участников
    if (!participants || participants.length < 4) {
      // Заходим в последнюю попытку - принудительно добавляем текущего юзера в лобби
      console.log("[TOURNAMENT] Not enough participants, attempting one more approach");
      
      // Проверяем, является ли текущий пользователь участником
      const isUserInLobby = participants?.some(p => p.user_id === authData.user.id) || false;
      
      if (!isUserInLobby) {
        try {
          // Добавляем текущего пользователя в лобби
          console.log("[TOURNAMENT] Adding current user to lobby as a last resort");
          await supabase
            .from('lobby_participants')
            .insert({
              lobby_id: lobbyId,
              user_id: authData.user.id,
              status: 'ready',
              is_ready: true
            });
            
          // Пересчитываем количество игроков после добавления
          const { data: newCount } = await supabase
            .from('lobby_participants')
            .select('id')
            .eq('lobby_id', lobbyId)
            .in('status', ['ready']);
            
          if (!newCount || newCount.length < 4) {
            throw new Error(`Недостаточно участников для создания турнира даже после добавления вас: ${newCount?.length || 0}/4`);
          }
        } catch (joinError) {
          console.error("[TOURNAMENT] Error adding current user to lobby:", joinError);
        }
      } else {
        throw new Error(`Недостаточно участников для создания турнира: ${participants.length}/4`);
      }
    }
    
    // Повторно загружаем участников для финальной проверки
    const { data: finalParticipants } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status, profile:profiles(id, username, avatar_url)')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready']);
    
    if (!finalParticipants || finalParticipants.length < 4) {
      throw new Error(`Не удалось собрать достаточно участников для создания турнира: ${finalParticipants?.length || 0}/4`);
    }
    
    console.log(`[TOURNAMENT] Creating tournament with ${finalParticipants.length} participants`);
    
    // Создаем турнир напрямую
    try {
      // Первый подход - непосредственная вставка
      console.log("[TOURNAMENT] Attempting direct tournament insert");
      
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          title: 'Быстрый турнир',
          max_participants: 4,
          status: 'active',
          type: 'quick',
          tournament_format: 'quick',
          lobby_id: lobbyId,
          current_participants: finalParticipants.length
        })
        .select('id')
        .single();
        
      if (tournamentError) {
        console.error("[TOURNAMENT] Error creating tournament manually:", tournamentError);
        throw tournamentError;
      }
      
      const tournamentId = tournament.id;
      console.log(`[TOURNAMENT] Tournament manually created: ${tournamentId}`);
      
      // Обновляем лобби с ID турнира
      await supabase
        .from('tournament_lobbies')
        .update({
          tournament_id: tournamentId,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', lobbyId);
        
      // Добавляем участников в турнир
      for (const participant of finalParticipants) {
        await supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournamentId,
            user_id: participant.user_id,
            status: 'active',
            points: 0
          });
      }
      
      // Создаем матчи для всех участников
      for (let i = 0; i < finalParticipants.length; i++) {
        for (let j = i + 1; j < finalParticipants.length; j++) {
          await supabase
            .from('matches')
            .insert({
              tournament_id: tournamentId,
              player1_id: finalParticipants[i].user_id,
              player2_id: finalParticipants[j].user_id,
              status: 'scheduled'
            });
        }
      }
      
      return { tournamentId, created: true };
    } catch (error) {
      console.error("[TOURNAMENT] Manual tournament creation failed:", error);
      
      // Проверяем, не был ли турнир уже создан кем-то другим параллельно
      const { data: checkLobby } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (checkLobby?.tournament_id) {
        console.log(`[TOURNAMENT] Tournament was created concurrently: ${checkLobby.tournament_id}`);
        return { tournamentId: checkLobby.tournament_id, created: false };
      }
      
      // Если всё же не смогли, вызываем последний раз RPC функцию
      console.log("[TOURNAMENT] Trying RPC one more time as last resort");
      try {
        const { data, error } = await supabase.rpc('create_matches_for_quick_tournament', {
          lobby_id: lobbyId
        });
        
        if (error) {
          console.error("[TOURNAMENT] Final RPC attempt failed:", error);
          throw error;
        }
        
        // Проверяем, был ли создан турнир
        const { data: finalCheck } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .maybeSingle();
          
        if (finalCheck?.tournament_id) {
          return { tournamentId: finalCheck.tournament_id, created: true };
        }
        
        throw new Error("Не удалось создать турнир всеми доступными методами");
      } catch (finalError) {
        console.error("[TOURNAMENT] All methods failed:", finalError);
        throw new Error("Все попытки создания турнира не удались, пожалуйста, попробуйте снова");
      }
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentManually:", error);
    throw error;
  }
};

/**
 * Create a tournament with retry logic
 */
export const createTournamentWithRetry = async (lobbyId: string) => {
  try {
    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, max_players, status, current_players')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (existingLobby?.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists: ${existingLobby.tournament_id}`);
      return { tournamentId: existingLobby.tournament_id, created: false };
    }
    
    // Проверяем, что max_players = 4
    if (existingLobby && existingLobby.max_players !== 4) {
      console.log(`[TOURNAMENT] Fixing max_players for lobby ${lobbyId} to 4`);
      await supabase
        .from('tournament_lobbies')
        .update({ max_players: 4 })
        .eq('id', lobbyId);
    }
    
    // Проверяем количество игроков непосредственно в базе данных
    const { data: participantCount, error: countError } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error counting participants:", countError);
    }
    
    const actualPlayerCount = participantCount ? participantCount.length : 0;
    console.log(`[TOURNAMENT] Current player count in database: ${actualPlayerCount}/4`);
    
    if (actualPlayerCount < 4) {
      throw new Error(`Недостаточно игроков для создания турнира: ${actualPlayerCount}/4`);
    }
    
    // Проверяем авторизацию
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("[TOURNAMENT] Authentication required but not available:", authError);
      throw new Error("Требуется авторизация для создания турнира");
    }
    
    // Принудительно обновляем статусы всех участников
    try {
      console.log("[TOURNAMENT] Updating all participants to ready status");
      const { error: updateError } = await supabase
        .from('lobby_participants')
        .update({ 
          status: 'ready',
          is_ready: true 
        })
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
        
      if (updateError) {
        console.error("[TOURNAMENT] Error updating participant status:", updateError);
      } else {
        console.log("[TOURNAMENT] Successfully updated participant status");
      }
    } catch (updateErr) {
      console.error("[TOURNAMENT] Error in update operation:", updateErr);
    }
    
    // Проверяем количество игроков со статусом ready
    const { data: readyParticipants, error: readyError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .eq('status', 'ready');
      
    if (readyError) {
      console.error("[TOURNAMENT] Error checking ready participants:", readyError);
    }
    
    console.log(`[TOURNAMENT] Ready participants after update: ${readyParticipants?.length || 0}/4`);
    
    if (!readyParticipants || readyParticipants.length < 4) {
      console.error(`[TOURNAMENT] Still not enough ready participants: ${readyParticipants?.length || 0}/4`);
      
      // Проверяем, является ли текущий пользователь одним из участников лобби
      const isUserInLobby = readyParticipants?.some(p => p.user_id === authData.user.id) || false;
      
      if (!isUserInLobby) {
        try {
          // Добавляем текущего пользователя в лобби
          console.log("[TOURNAMENT] Adding current user to lobby");
          await supabase
            .from('lobby_participants')
            .insert({
              lobby_id: lobbyId,
              user_id: authData.user.id,
              status: 'ready',
              is_ready: true
            });
        } catch (joinError) {
          console.error("[TOURNAMENT] Error adding user to lobby:", joinError);
        }
      }
    }
    
    // Пробуем создать турнир с использованием RPC
    try {
      console.log("[TOURNAMENT] Attempting to create tournament via RPC");
      return await createTournamentViaRPC(lobbyId);
    } catch (rpcError) {
      console.error("[TOURNAMENT] RPC creation failed, trying manual creation:", rpcError);
      
      // Проверяем, не был ли турнир уже создан
      const { data: checkLobby } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (checkLobby?.tournament_id) {
        console.log(`[TOURNAMENT] Tournament was created concurrently: ${checkLobby.tournament_id}`);
        return { tournamentId: checkLobby.tournament_id, created: false };
      }
      
      // Пробуем создать турнир вручную
      try {
        return await createTournamentManually(lobbyId);
      } catch (manualError) {
        console.error("[TOURNAMENT] Manual creation also failed:", manualError);
        throw new Error("Не удалось создать турнир ни одним из доступных методов. Пожалуйста, попробуйте снова.");
      }
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentWithRetry:", error);
    throw error;
  }
};
