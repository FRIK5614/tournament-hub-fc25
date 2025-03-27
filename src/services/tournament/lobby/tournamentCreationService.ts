
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
      .select('id, user_id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error checking participant count:", countError);
      throw new Error("Не удалось проверить количество участников");
    }
    
    const actualPlayerCount = participantCount ? participantCount.length : 0;
    console.log(`[TOURNAMENT] Actual player count in database: ${actualPlayerCount}/4`);
    
    if (actualPlayerCount < 4) {
      throw new Error(`Недостаточно игроков для создания турнира: ${actualPlayerCount}/4`);
    }

    // Принудительно изменяем статус всех участников на 'ready' и is_ready = true
    console.log("[TOURNAMENT] Setting all participants to ready status");
    const { error: updateError } = await supabase
      .from('lobby_participants')
      .update({
        status: 'ready',
        is_ready: true
      })
      .eq('lobby_id', lobbyId);
      
    if (updateError) {
      console.error("[TOURNAMENT] Error updating participants to ready:", updateError);
    }
    
    // Получаем обновленный список участников - исправленная версия без JOIN к profiles
    const { data: readyParticipants, error: readyError } = await supabase
      .from('lobby_participants')
      .select('user_id')
      .eq('lobby_id', lobbyId)
      .eq('status', 'ready');
      
    if (readyError) {
      console.error("[TOURNAMENT] Error checking ready participants:", readyError);
    } else {
      console.log(`[TOURNAMENT] Ready participants after update: ${readyParticipants?.length || 0}/4`);
      
      // Исправленная версия без доступа к profile.username
      console.log("[TOURNAMENT] Ready participants:", readyParticipants?.map(p => p.user_id));
    }
    
    console.log(`[TOURNAMENT] Creating tournament via RPC as user ${authData.user.id}`);
    
    // Защита от RLS ошибок - проверяем, что текущий пользователь является участником лобби
    const currentUserIsParticipant = participantCount.some(p => p.user_id === authData.user.id);
    if (!currentUserIsParticipant) {
      console.log("[TOURNAMENT] Current user is not part of the lobby - adding user");
      
      try {
        const { error: joinError } = await supabase
          .from('lobby_participants')
          .upsert({
            lobby_id: lobbyId,
            user_id: authData.user.id,
            status: 'ready',
            is_ready: true
          }, { onConflict: 'lobby_id,user_id' });
          
        if (joinError) {
          console.error("[TOURNAMENT] Error upserting current user to lobby:", joinError);
          throw new Error("Не удалось добавить вас в лобби");
        }
        
        console.log("[TOURNAMENT] Successfully added/updated current user in lobby");
      } catch (joinError) {
        console.error("[TOURNAMENT] Error joining lobby:", joinError);
        
        // Если была ошибка, попытаемся обновить существующую запись
        try {
          const { error: updateUserError } = await supabase
            .from('lobby_participants')
            .update({
              status: 'ready',
              is_ready: true
            })
            .eq('lobby_id', lobbyId)
            .eq('user_id', authData.user.id);
            
          if (updateUserError) {
            console.error("[TOURNAMENT] Error updating user status:", updateUserError);
          }
        } catch (updateError) {
          console.error("[TOURNAMENT] Error updating user:", updateError);
        }
      }
    }
    
    // Напрямую создаем турнир без использования RPC
    try {
      console.log("[TOURNAMENT] Creating tournament directly");
      
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          title: 'Быстрый турнир',
          max_participants: 4,
          status: 'active',
          type: 'quick',
          tournament_format: 'quick',
          lobby_id: lobbyId,
          current_participants: actualPlayerCount
        })
        .select('id')
        .single();
        
      if (tournamentError) {
        console.error("[TOURNAMENT] Error creating tournament:", tournamentError);
        throw tournamentError;
      }
      
      const tournamentId = tournament.id;
      console.log(`[TOURNAMENT] Tournament created with ID: ${tournamentId}`);
      
      // Обновляем лобби с ID турнира
      await supabase
        .from('tournament_lobbies')
        .update({
          tournament_id: tournamentId,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', lobbyId);
        
      // Добавляем всех участников в турнир
      const participantPromises = participantCount.map(participant => {
        return supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournamentId,
            user_id: participant.user_id,
            status: 'active',
            points: 0
          })
          .then(({ error }) => {
            if (error) {
              console.error(`[TOURNAMENT] Error adding participant ${participant.user_id} to tournament:`, error);
            }
          });
      });
      
      await Promise.all(participantPromises);
      
      // Создаем матчи для всех участников
      const matchPromises = [];
      for (let i = 0; i < participantCount.length; i++) {
        for (let j = i + 1; j < participantCount.length; j++) {
          matchPromises.push(
            supabase
              .from('matches')
              .insert({
                tournament_id: tournamentId,
                player1_id: participantCount[i].user_id,
                player2_id: participantCount[j].user_id,
                status: 'scheduled'
              })
              .then(({ error }) => {
                if (error) {
                  console.error(`[TOURNAMENT] Error creating match between ${participantCount[i].user_id} and ${participantCount[j].user_id}:`, error);
                }
              })
          );
        }
      }
      
      await Promise.all(matchPromises);
      
      return { tournamentId, created: true };
    } catch (error) {
      console.error("[TOURNAMENT] Direct tournament creation failed:", error);
      
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
      
      throw error;
    }
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
    
    // Проверяем количество игроков в лобби непосредственно в базе данных
    const { data: participantCount, error: countError } = await supabase
      .from('lobby_participants')
      .select('id, user_id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error checking participant count:", countError);
    }
    
    const actualPlayerCount = participantCount ? participantCount.length : 0;
    console.log(`[TOURNAMENT] Manual creation - Actual player count: ${actualPlayerCount}/4`);
    
    if (actualPlayerCount < 4) {
      // Заходим в последнюю попытку - принудительно добавляем текущего юзера в лобби
      console.log("[TOURNAMENT] Not enough participants, attempting to add current user");
      
      // Проверяем, является ли текущий пользователь участником
      const isUserInLobby = participantCount?.some(p => p.user_id === authData.user.id) || false;
      
      if (!isUserInLobby) {
        try {
          // Добавляем текущего пользователя в лобби используя upsert для избежания ошибок дубликатов
          console.log("[TOURNAMENT] Adding current user to lobby as a last resort");
          await supabase
            .from('lobby_participants')
            .upsert({
              lobby_id: lobbyId,
              user_id: authData.user.id,
              status: 'ready',
              is_ready: true
            }, { onConflict: 'lobby_id,user_id' });
            
          // Пересчитываем количество игроков после добавления
          const { data: newCount } = await supabase
            .from('lobby_participants')
            .select('id')
            .eq('lobby_id', lobbyId)
            .in('status', ['ready', 'searching']);
            
          if (!newCount || newCount.length < 4) {
            throw new Error(`Недостаточно участников для создания турнира даже после добавления вас: ${newCount?.length || 0}/4`);
          }
        } catch (joinError) {
          console.error("[TOURNAMENT] Error adding current user to lobby:", joinError);
          
          // Пробуем обновить существующую запись, если есть
          try {
            await supabase
              .from('lobby_participants')
              .update({
                status: 'ready',
                is_ready: true
              })
              .eq('lobby_id', lobbyId)
              .eq('user_id', authData.user.id);
              
          } catch (updateError) {
            console.error("[TOURNAMENT] Error updating existing record:", updateError);
            throw new Error("Не удалось добавить вас в лобби и обеспечить необходимое количество игроков");
          }
        }
      } else {
        throw new Error(`Недостаточно участников для создания турнира: ${actualPlayerCount}/4`);
      }
    }

    // Force update all participants to ready status
    console.log("[TOURNAMENT] Setting all participants to ready status");
    await supabase
      .from('lobby_participants')
      .update({ 
        is_ready: true, 
        status: 'ready' 
      })
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
    
    // After update, fetch all participants
    const { data: participants, error: participantsCheckError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready']);
      
    if (participantsCheckError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsCheckError);
      throw participantsCheckError;
    }
    
    // Проверяем, есть ли достаточно участников
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    console.log(`[TOURNAMENT] Creating tournament with ${participants.length} participants`);
    
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
          current_participants: participants.length
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
        
      // Добавляем участников в турнир - используем Promise.all для параллельной обработки
      const participantPromises = participants.map(participant => {
        return supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournamentId,
            user_id: participant.user_id,
            status: 'active',
            points: 0
          })
          .then(({ error }) => {
            if (error) {
              console.error(`[TOURNAMENT] Error adding participant ${participant.user_id} to tournament:`, error);
            }
          });
      });
      
      await Promise.all(participantPromises);
      
      // Создаем матчи для всех участников - также параллельно
      const matchPromises = [];
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          matchPromises.push(
            supabase
              .from('matches')
              .insert({
                tournament_id: tournamentId,
                player1_id: participants[i].user_id,
                player2_id: participants[j].user_id,
                status: 'scheduled'
              })
              .then(({ error }) => {
                if (error) {
                  console.error(`[TOURNAMENT] Error creating match between ${participants[i].user_id} and ${participants[j].user_id}:`, error);
                }
              })
          );
        }
      }
      
      await Promise.all(matchPromises);
      
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
      
      throw new Error("Не удалось создать турнир всеми доступными методами");
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
    
    // Проверяем авторизацию
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("[TOURNAMENT] Authentication required but not available:", authError);
      throw new Error("Требуется авторизация для создания турнира");
    }
    
    // Проверяем, что max_players = 4
    if (existingLobby && existingLobby.max_players !== 4) {
      console.log(`[TOURNAMENT] Fixing max_players for lobby ${lobbyId} to 4`);
      await supabase
        .from('tournament_lobbies')
        .update({ max_players: 4 })
        .eq('id', lobbyId);
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
    
    // Проверяем количество игроков в лобби непосредственно в базе данных
    const { data: participantCount, error: countError } = await supabase
      .from('lobby_participants')
      .select('id, user_id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error counting participants:", countError);
    }
    
    const actualPlayerCount = participantCount ? participantCount.length : 0;
    console.log(`[TOURNAMENT] Current player count in database: ${actualPlayerCount}/4`);
    
    // Проверяем, является ли текущий пользователь одним из участников лобби
    const isUserInLobby = participantCount?.some(p => p.user_id === authData.user.id) || false;
    
    if (!isUserInLobby) {
      try {
        // Используем upsert вместо insert для избежания ошибок с дубликатами
        console.log("[TOURNAMENT] Adding current user to lobby");
        await supabase
          .from('lobby_participants')
          .upsert({
            lobby_id: lobbyId,
            user_id: authData.user.id,
            status: 'ready',
            is_ready: true
          }, { onConflict: 'lobby_id,user_id' });
          
        console.log("[TOURNAMENT] Successfully added current user to lobby");
      } catch (joinError) {
        console.error("[TOURNAMENT] Error adding user to lobby:", joinError);
        
        // Пробуем обновить существующую запись
        try {
          await supabase
            .from('lobby_participants')
            .update({
              status: 'ready',
              is_ready: true
            })
            .eq('lobby_id', lobbyId)
            .eq('user_id', authData.user.id);
            
          console.log("[TOURNAMENT] Successfully updated existing user record");
        } catch (updateError) {
          console.error("[TOURNAMENT] Error updating existing user:", updateError);
        }
      }
      
      // Пересчитываем количество игроков после добавления
      const { data: updatedCount } = await supabase
        .from('lobby_participants')
        .select('id, user_id')
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
        
      const newPlayerCount = updatedCount ? updatedCount.length : 0;
      console.log(`[TOURNAMENT] Updated player count after adding current user: ${newPlayerCount}/4`);
    }
    
    if (actualPlayerCount < 4) {
      // Еще раз проверяем количество игроков после обновления
      const { data: finalCheck } = await supabase
        .from('lobby_participants')
        .select('id, user_id')
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
        
      const finalCount = finalCheck ? finalCheck.length : 0;
      
      if (finalCount < 4) {
        throw new Error(`Недостаточно игроков для создания турнира: ${finalCount}/4`);
      }
    }
    
    // Пробуем создать турнир с использованием прямого метода
    try {
      console.log("[TOURNAMENT] Attempting to create tournament directly");
      return await createTournamentViaRPC(lobbyId);
    } catch (directError) {
      console.error("[TOURNAMENT] Direct creation failed, trying manual creation:", directError);
      
      // Делаем паузу перед повторной попыткой
      await delay(1000);
      
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
