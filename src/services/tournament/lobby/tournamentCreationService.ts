
import { supabase } from "@/integrations/supabase/client";

/**
 * Create a tournament for a lobby by calling the RPC function
 */
export const createTournamentViaRPC = async (lobbyId: string) => {
  try {
    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, max_players')
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
    
    // Verify authentication before creating tournament
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("[TOURNAMENT] Authentication error:", authError);
      throw new Error("Убедитесь, что вы авторизованы для создания турнира");
    }
    
    console.log(`[TOURNAMENT] Attempting to create tournament via RPC as user ${authData.user.id}`);
    
    // Before creating, double-check the ready status of all participants
    const { data: participants, error: participantsCheckError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready', 'searching']);
      
    if (participantsCheckError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsCheckError);
      throw participantsCheckError;
    }
    
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    const readyCount = participants.filter(p => p.is_ready).length;
    const readyStatusCount = participants.filter(p => p.status === 'ready').length;
    
    console.log(`[TOURNAMENT] Ready count: ${readyCount}, Ready status count: ${readyStatusCount}`);
    
    if (readyCount < 4 || readyStatusCount < 4) {
      throw new Error(`Не все игроки подтвердили готовность: ready=${readyCount}/4, status ready=${readyStatusCount}/4`);
    }
    
    // Try to create tournament using RPC (which should handle permissions)
    try {
      console.log("[TOURNAMENT] Using RPC to create tournament matches");
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_matches_for_quick_tournament', {
        lobby_id: lobbyId
      });
      
      if (rpcError) {
        console.error("[TOURNAMENT] RPC error details:", rpcError);
        if (rpcError.code === "42501") {
          console.error("[TOURNAMENT] Permission denied - RLS violation. User lacks permission to insert into tournaments table.");
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
    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, max_players')
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
    
    // Verify authentication before creating tournament
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("[TOURNAMENT] Authentication error:", authError);
      throw new Error("Убедитесь, что вы авторизованы для создания турнира");
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
    const readyStatusCount = participants.filter(p => p.status === 'ready').length;
    
    console.log(`[TOURNAMENT] Manual creation - Ready count: ${readyCount}, Ready status count: ${readyStatusCount}`);
    
    if (readyCount < 4 || readyStatusCount < 4) {
      console.error(`[TOURNAMENT] Not all players are ready: ready=${readyCount}/4, status ready=${readyStatusCount}/4`);
      participants.forEach(p => {
        console.log(`Player ${p.user_id} - ready: ${p.is_ready}, status: ${p.status}`);
      });
      throw new Error(`Не все игроки подтвердили готовность: готовы=${readyCount}/4, статус готов=${readyStatusCount}/4`);
    }
    
    console.log(`[TOURNAMENT] Creating tournament with ${participants.length} participants`);
    
    // Try with different approaches to handle potential RLS issues
    try {
      // First attempt: Direct insert
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
          current_participants: 4
        })
        .select('id')
        .single();
        
      if (tournamentError) {
        console.error("[TOURNAMENT] Error creating tournament manually:", tournamentError);
        if (tournamentError.code === "42501") {
          console.error("[TOURNAMENT] RLS policy violation - looking for a workaround");
          throw new Error("Отказано в доступе: RLS policy violation");
        }
        throw tournamentError;
      }
      
      const tournamentId = tournament.id;
      console.log(`[TOURNAMENT] Tournament manually created: ${tournamentId}`);
      
      // Update lobby with tournament ID
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
        
      // Add participants
      for (const participant of participants) {
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
          // Продолжаем с другими участниками
        }
      }
      
      // Create matches for all participants
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
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
          }
        }
      }
      
      return { tournamentId, created: true };
    } catch (directInsertError) {
      console.error("[TOURNAMENT] Direct insert approach failed:", directInsertError);
      
      // Second attempt: Try another method if available
      // This could be implemented as a fallback if you have another way
      // to create tournaments that might bypass RLS issues
      
      throw directInsertError; // Re-throw for now since we don't have an alternative
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
      .select('tournament_id, max_players')
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
    const statusReadyCount = participants.filter(p => p.status === 'ready').length;
    
    console.log(`[TOURNAMENT] Ready check stats - is_ready: ${readyCount}/4, status 'ready': ${statusReadyCount}/4`);
    
    participants.forEach(p => {
      console.log(`[TOURNAMENT] Player ${p.user_id}: is_ready=${p.is_ready}, status=${p.status}`);
    });
    
    if (readyCount < 4) {
      throw new Error(`Не все игроки готовы: ${readyCount}/4`);
    }
    
    // Try RPC first
    try {
      console.log(`[TOURNAMENT] Attempting to create tournament via RPC for lobby ${lobbyId}`);
      return await createTournamentViaRPC(lobbyId);
    } catch (rpcError) {
      console.error("[TOURNAMENT] RPC creation failed, trying manual creation:", rpcError);
      
      // Try manual creation as fallback
      return await createTournamentManually(lobbyId);
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentWithRetry:", error);
    throw error;
  }
};
