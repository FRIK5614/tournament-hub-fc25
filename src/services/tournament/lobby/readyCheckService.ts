
import { supabase } from "@/integrations/supabase/client";
import { withRetry, delay } from "../utils";

/**
 * Mark a user as ready in a tournament lobby
 */
export const markUserAsReady = async (lobbyId: string) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для участия в турнирах");
  }
  
  console.log(`[TOURNAMENT] User ${user.user.id} marking as ready in lobby ${lobbyId}`);
  
  try {
    // First verify this lobby is in ready_check state with 4 players
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players, tournament_id')
      .eq('id', lobbyId)
      .single();
      
    if (lobbyError) {
      console.error("[TOURNAMENT] Error checking lobby status:", lobbyError);
      throw new Error("Не удалось проверить статус лобби");
    }
    
    // If tournament already exists, return early with success
    if (lobby.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists for lobby ${lobbyId}, ID: ${lobby.tournament_id}`);
      return { 
        ready: true, 
        allReady: true,
        tournamentId: lobby.tournament_id 
      };
    }
    
    if (lobby.status !== 'ready_check') {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} not in ready_check state (${lobby.status})`);
      throw new Error("Лобби не в состоянии проверки готовности");
    }
    
    if (lobby.current_players !== 4) {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} does not have 4 players (${lobby.current_players})`);
      throw new Error("Недостаточно игроков для начала турнира");
    }
    
    // Mark current user as ready
    const { error } = await supabase
      .from('lobby_participants')
      .update({
        is_ready: true,
        status: 'ready'
      })
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id);
    
    if (error) {
      console.error("[TOURNAMENT] Error marking user as ready:", error);
      throw new Error("Не удалось подтвердить готовность. Пожалуйста, попробуйте снова.");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} successfully marked as ready`);
    
    // Check if all players are ready and create tournament if needed
    const readyResult = await checkAllPlayersReady(lobbyId);
    
    return { 
      ready: true, 
      allReady: readyResult.allReady,
      tournamentId: readyResult.tournamentId 
    };
  } catch (error) {
    console.error("[TOURNAMENT] Error in markUserAsReady:", error);
    throw error;
  }
};

/**
 * Check if all players are ready and create a tournament if needed
 */
export const checkAllPlayersReady = async (lobbyId: string) => {
  try {
    console.log(`[TOURNAMENT] Checking all players ready for lobby ${lobbyId}`);
    
    // Get lobby info first
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('id, current_players, max_players, status, tournament_id')
      .eq('id', lobbyId)
      .single();
    
    if (lobbyError) {
      console.error("[TOURNAMENT] Error getting lobby info:", lobbyError);
      return { allReady: false, tournamentId: null };
    }
    
    console.log(`[TOURNAMENT] Lobby ${lobbyId} status: ${lobby.status}, players: ${lobby.current_players}/${lobby.max_players}, tournament: ${lobby.tournament_id || 'none'}`);
    
    // If tournament is already created, return its ID
    if (lobby.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists for lobby ${lobbyId}, ID: ${lobby.tournament_id}`);
      return { allReady: true, tournamentId: lobby.tournament_id };
    }
    
    // Get all participants in the lobby
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
    
    if (participantsError) {
      console.error("[TOURNAMENT] Error checking player readiness:", participantsError);
      return { allReady: false, tournamentId: null };
    }
    
    if (!participants || participants.length === 0) {
      console.log(`[TOURNAMENT] No active participants found for lobby ${lobbyId}`);
      return { allReady: false, tournamentId: null };
    }
    
    // Log detailed information about participants
    participants.forEach(p => {
      console.log(`[TOURNAMENT] Participant in ${lobbyId}: userId=${p.user_id}, isReady=${p.is_ready}, status=${p.status}`);
    });
    
    // Count only truly ready players (both is_ready flag and status = 'ready')
    const readyParticipants = participants.filter(p => p.is_ready && p.status === 'ready') || [];
    const activeParticipants = participants.length || 0;
    
    console.log(`[TOURNAMENT] Lobby ${lobbyId} has ${readyParticipants.length} ready participants out of ${activeParticipants} active participants`);
    
    // Check if we have exactly the right number of players and they're all ready
    if (readyParticipants.length === lobby.max_players && activeParticipants === lobby.max_players) {
      console.log(`[TOURNAMENT] All ${lobby.max_players} players are ready in lobby ${lobbyId}. Creating tournament...`);
      
      // We need to first make sure the ready_check state is active
      if (lobby.status !== 'ready_check') {
        const { error: statusUpdateError } = await supabase
          .from('tournament_lobbies')
          .update({ 
            status: 'ready_check',
            ready_check_started_at: new Date().toISOString()
          })
          .eq('id', lobbyId);
        
        if (statusUpdateError) {
          console.error("[TOURNAMENT] Error updating lobby status before tournament creation:", statusUpdateError);
          return { allReady: true, tournamentId: null };
        }
        
        // Add a delay to ensure the status update is processed
        await delay(1000);
      }
      
      // Now update to 'waiting' which is required by the tournament creation function
      const { error: waitingStatusError } = await supabase
        .from('tournament_lobbies')
        .update({ status: 'waiting' })
        .eq('id', lobbyId);
      
      if (waitingStatusError) {
        console.error("[TOURNAMENT] Error updating lobby status to waiting:", waitingStatusError);
        return { allReady: true, tournamentId: null };
      }
      
      // Add a delay to ensure the status update is processed
      await delay(1000);
      
      try {
        // Call the RPC function to create a tournament with retries
        console.log(`[TOURNAMENT] Calling create_matches_for_quick_tournament for lobby ${lobbyId}`);
        
        const { data, error } = await withRetry(async () => {
          const response = await supabase.rpc('create_matches_for_quick_tournament', {
            lobby_id: lobbyId
          });
          return response;
        });
        
        if (error) {
          console.error("[TOURNAMENT] Error creating tournament:", error);
          return { allReady: true, tournamentId: null };
        }
        
        // Add a delay to ensure tournament is created
        await delay(2000);
        
        // Get the tournament ID that was created
        const { data: updatedLobby, error: updateError } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id, status')
          .eq('id', lobbyId)
          .single();
        
        if (updateError || !updatedLobby?.tournament_id) {
          console.error("[TOURNAMENT] Error getting tournament ID or tournament not created");
          return { allReady: true, tournamentId: null };
        }
        
        // Make sure lobby status is 'active'
        if (updatedLobby.status !== 'active') {
          await supabase
            .from('tournament_lobbies')
            .update({ status: 'active' })
            .eq('id', lobbyId);
        }
        
        console.log(`[TOURNAMENT] Tournament created successfully! ID: ${updatedLobby.tournament_id}`);
        return { allReady: true, tournamentId: updatedLobby.tournament_id };
      } catch (error) {
        console.error("[TOURNAMENT] Error in tournament creation process:", error);
        return { allReady: true, tournamentId: null };
      }
    }
    
    console.log(`[TOURNAMENT] Not all players are ready yet in lobby ${lobbyId}`);
    return { allReady: false, tournamentId: null };
  } catch (error) {
    console.error("[TOURNAMENT] Error in checkAllPlayersReady:", error);
    return { allReady: false, tournamentId: null };
  }
};
