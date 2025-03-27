
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
    
    // Проверяем количество игроков
    if (existingLobby && existingLobby.current_players < 4) {
      throw new Error(`Недостаточно игроков: ${existingLobby.current_players}/4`);
    }
    
    console.log(`[TOURNAMENT] Attempting to create tournament via RPC as user ${authData.user.id}`);
    
    // Before creating, double-check the ready status of all participants
    const { data: participants, error: participantsCheckError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready']);
      
    if (participantsCheckError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsCheckError);
      throw participantsCheckError;
    }
    
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    const readyCount = participants.filter(p => p.is_ready).length;
    
    console.log(`[TOURNAMENT] Ready count: ${readyCount}/4, Total participants: ${participants.length}`);
    
    if (readyCount < 4) {
      throw new Error(`Не все игроки подтвердили готовность: ready=${readyCount}/4`);
    }
    
    // Защита от RLS ошибок - проверяем, что текущий пользователь является участником лобби
    const isUserPartOfLobby = participants.some(p => p.user_id === authData.user.id);
    if (!isUserPartOfLobby) {
      console.error("[TOURNAMENT] Current user is not part of the lobby - possible RLS violation");
      throw new Error("У вас нет прав для создания турнира в этом лобби");
    }
    
    // Try to create tournament using RPC with retry logic
    try {
      console.log("[TOURNAMENT] Using RPC to create tournament matches");
      const { data: rpcData, error: rpcError } = await withRetry(async () => {
        return await supabase.rpc('create_matches_for_quick_tournament', {
          lobby_id: lobbyId
        });
      }, 3);
      
      if (rpcError) {
        console.error("[TOURNAMENT] RPC error details:", rpcError);
        if (rpcError.code === "42501") {
          console.error("[TOURNAMENT] Permission denied - RLS violation. User lacks permission to insert into tournaments table.");
          // Ошибка RLS - попробуем ручной метод
          throw new Error("Ошибка разрешений при создании турнира. Пробуем другой способ.");
        }
        throw rpcError;
      }
      
      console.log(`[TOURNAMENT] RPC execution successful:`, rpcData);
    } catch (rpcInnerError) {
      console.error("[TOURNAMENT] Inner RPC error:", rpcInnerError);
      throw rpcInnerError;
    }
    
    // Check if tournament was created successfully by RPC
    const { data: updatedLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (!updatedLobby?.tournament_id) {
      throw new Error("Турнир не был создан при выполнении RPC. Проверьте права доступа.");
    }
    
    console.log(`[TOURNAMENT] Tournament created via RPC: ${updatedLobby.tournament_id}`);
    return { tournamentId: updatedLobby.tournament_id, created: true };
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentViaRPC:", error);
    throw error;
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
    
    // Проверяем, что max_players = 4
    if (existingLobby && existingLobby.max_players !== 4) {
      console.log(`[TOURNAMENT] Fixing max_players for lobby ${lobbyId} to 4`);
      await supabase
        .from('tournament_lobbies')
        .update({ max_players: 4 })
        .eq('id', lobbyId);
    }
    
    // Проверяем количество игроков
    if (existingLobby && existingLobby.current_players < 4) {
      throw new Error(`Недостаточно игроков для создания турнира: ${existingLobby.current_players}/4`);
    }
    
    console.log(`[TOURNAMENT] Creating tournament manually as user ${authData.user.id}`);
    
    // Before creating, double-check the ready status of all participants
    const { data: participants, error: participantsCheckError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status, profile:profiles(id, username, avatar_url)')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready']);
      
    if (participantsCheckError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsCheckError);
      throw participantsCheckError;
    }
    
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    const readyCount = participants.filter(p => p.is_ready).length;
    
    console.log(`[TOURNAMENT] Manual creation - Ready count: ${readyCount}/4, Total participants: ${participants.length}`);
    
    if (readyCount < 4) {
      console.error(`[TOURNAMENT] Not all players are ready: ready=${readyCount}/4`);
      participants.forEach(p => {
        console.log(`Player ${p.user_id} - ready: ${p.is_ready}, status: ${p.status}`);
      });
      throw new Error(`Не все игроки подтвердили готовность: готовы=${readyCount}/4`);
    }
    
    // Проверяем, что текущий пользователь является участником лобби (защита от RLS ошибок)
    const isUserPartOfLobby = participants.some(p => p.user_id === authData.user.id);
    if (!isUserPartOfLobby) {
      console.error("[TOURNAMENT] Current user is not part of the lobby - possible RLS violation");
      throw new Error("У вас нет прав для создания турнира в этом лобби");
    }
    
    console.log(`[TOURNAMENT] Creating tournament with ${participants.length} participants`);
    
    // Try with different approaches to handle potential RLS issues
    try {
      // First attempt: Direct insert with auth.uid() validation
      console.log("[TOURNAMENT] Attempting direct tournament insert");
      
      // Создаем турнир от имени текущего пользователя с использованием retry логики
      const { data: tournament, error: tournamentError } = await withRetry(async () => {
        return await supabase
          .from('tournaments')
          .insert({
            title: 'Быстрый турнир',
            max_participants: 4,
            status: 'active',
            type: 'quick',
            tournament_format: 'quick',
            lobby_id: lobbyId,
            current_participants: 4
          })
          .select('id')
          .single();
      }, 3);
        
      if (tournamentError) {
        console.error("[TOURNAMENT] Error creating tournament manually:", tournamentError);
        if (tournamentError.code === "42501") {
          console.error("[TOURNAMENT] RLS policy violation - looking for a workaround");
          throw new Error("Отказано в доступе при создании турнира: RLS policy violation");
        }
        throw tournamentError;
      }
      
      const tournamentId = tournament.id;
      console.log(`[TOURNAMENT] Tournament manually created: ${tournamentId}`);
      
      // Update lobby with tournament ID with retry logic
      await withRetry(async () => {
        const { error: updateLobbyError } = await supabase
          .from('tournament_lobbies')
          .update({
            tournament_id: tournamentId,
            status: 'active',
            started_at: new Date().toISOString()
          })
          .eq('id', lobbyId);
          
        if (updateLobbyError) {
          console.error("[TOURNAMENT] Error updating lobby with tournament ID:", updateLobbyError);
          throw updateLobbyError;
        }
        return { success: true };
      }, 3);
        
      // Add participants with retry logic
      const participantPromises = participants.map(participant => 
        withRetry(async () => {
          const { error: participantError } = await supabase
            .from('tournament_participants')
            .insert({
              tournament_id: tournamentId,
              user_id: participant.user_id,
              status: 'active',
              points: 0
            });
            
          if (participantError) {
            console.error(`[TOURNAMENT] Error adding participant ${participant.user_id}:`, participantError);
            throw participantError;
          }
          return { success: true };
        }, 2)
      );
      
      await Promise.allSettled(participantPromises);
      
      // Create matches for all participants with retry logic
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          await withRetry(async () => {
            const { error: matchError } = await supabase
              .from('matches')
              .insert({
                tournament_id: tournamentId,
                player1_id: participants[i].user_id,
                player2_id: participants[j].user_id,
                status: 'scheduled'
              });
              
            if (matchError) {
              console.error(`[TOURNAMENT] Error creating match between ${participants[i].user_id} and ${participants[j].user_id}:`, matchError);
              throw matchError;
            }
            return { success: true };
          }, 2);
        }
      }
      
      return { tournamentId, created: true };
    } catch (directInsertError) {
      console.error("[TOURNAMENT] Direct insert approach failed:", directInsertError);
      
      // Проверим, не был ли турнир уже создан кем-то другим
      const { data: checkLobby } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (checkLobby?.tournament_id) {
        console.log(`[TOURNAMENT] Tournament was created concurrently: ${checkLobby.tournament_id}`);
        return { tournamentId: checkLobby.tournament_id, created: false };
      }
      
      // Если все попытки не удались, перезапускаем RPC функцию как запасной вариант
      console.log("[TOURNAMENT] Falling back to RPC method as a last resort");
      try {
        await withRetry(async () => {
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_matches_for_quick_tournament', {
            lobby_id: lobbyId
          });
          
          if (rpcError) {
            console.error("[TOURNAMENT] Final fallback RPC error:", rpcError);
            throw rpcError;
          }
          return { success: true };
        }, 2);
        
        // Проверяем, был ли создан турнир
        const { data: finalLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .maybeSingle();
          
        if (finalLobby?.tournament_id) {
          console.log(`[TOURNAMENT] Tournament created via fallback RPC: ${finalLobby.tournament_id}`);
          return { tournamentId: finalLobby.tournament_id, created: true };
        }
        
        throw new Error("Турнир не был создан даже после всех попыток");
      } catch (rpcFallbackError) {
        console.error("[TOURNAMENT] RPC fallback also failed:", rpcFallbackError);
        throw new Error("Все попытки создания турнира не удались");
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
    
    // Проверяем количество игроков
    if (existingLobby && existingLobby.current_players < 4) {
      throw new Error(`Недостаточно игроков для создания турнира: ${existingLobby.current_players}/4`);
    }
    
    // Проверяем авторизацию
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("[TOURNAMENT] Authentication required but not available:", authError);
      throw new Error("Требуется авторизация для создания турнира");
    }
    
    // Сначала проверим, все ли игроки действительно готовы
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready']);
      
    if (participantsError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsError);
      throw participantsError;
    }
    
    if (!participants || participants.length < 4) {
      console.error(`[TOURNAMENT] Not enough participants: ${participants?.length || 0}/4`);
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    const readyCount = participants.filter(p => p.is_ready).length;
    
    console.log(`[TOURNAMENT] Ready check stats - is_ready: ${readyCount}/4, participants: ${participants.length}`);
    
    participants.forEach(p => {
      console.log(`[TOURNAMENT] Player ${p.user_id}: is_ready=${p.is_ready}, status=${p.status}`);
    });
    
    if (readyCount < 4) {
      throw new Error(`Не все игроки готовы: ${readyCount}/4`);
    }
    
    // Проверяем, что текущий пользователь является участником лобби (защита от RLS ошибок)
    const isUserPartOfLobby = participants.some(p => p.user_id === authData.user.id);
    if (!isUserPartOfLobby) {
      console.error("[TOURNAMENT] Current user is not part of the lobby - possible RLS violation");
      throw new Error("У вас нет прав для создания турнира в этом лобби");
    }

    // Try RPC first
    try {
      console.log(`[TOURNAMENT] Attempting to create tournament via RPC for lobby ${lobbyId}`);
      return await createTournamentViaRPC(lobbyId);
    } catch (rpcError) {
      console.error("[TOURNAMENT] RPC creation failed, trying manual creation:", rpcError);
      
      // Добавляем паузу перед попыткой ручного создания
      await delay(500);
      
      // Проверяем, не был ли турнир уже создан (возможно, другим игроком)
      const { data: checkLobby } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (checkLobby?.tournament_id) {
        console.log(`[TOURNAMENT] Tournament was created concurrently: ${checkLobby.tournament_id}`);
        return { tournamentId: checkLobby.tournament_id, created: false };
      }
      
      // Try manual creation as fallback
      return await createTournamentManually(lobbyId);
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentWithRetry:", error);
    throw error;
  }
};
