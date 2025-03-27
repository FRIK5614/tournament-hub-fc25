
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
    
    // If tournament is already created, return its ID
    if (lobby.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists for lobby ${lobbyId}, ID: ${lobby.tournament_id}`);
      return { allReady: true, tournamentId: lobby.tournament_id };
    }

    // No tournament but lobby is active - something went wrong
    if (lobby.status === 'active') {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} is active but has no tournament. Trying to force create tournament.`);
      const result = await forceTournamentCreation(lobbyId);
      return { allReady: true, tournamentId: result.tournamentId };
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
      
      return await createTournament(lobbyId);
    }
    
    console.log(`[TOURNAMENT] Not all players are ready yet in lobby ${lobbyId}`);
    return { allReady: false, tournamentId: null };
  } catch (error) {
    console.error("[TOURNAMENT] Error in checkAllPlayersReady:", error);
    return { allReady: false, tournamentId: null };
  }
};

/**
 * Create a tournament for a lobby
 */
const createTournament = async (lobbyId: string) => {
  try {
    // First, mark lobby as 'waiting' which is required by the tournament creation function
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ status: 'waiting' })
      .eq('id', lobbyId);
    
    if (updateError) {
      console.error("[TOURNAMENT] Error updating lobby status to waiting:", updateError);
      return { allReady: true, tournamentId: null };
    }
    
    // Add a delay to ensure the status update is processed
    await delay(500);
    
    // Call RPC function with improved retry logic
    const { data, error } = await withRetry(async () => {
      console.log(`[TOURNAMENT] Calling create_matches_for_quick_tournament for lobby ${lobbyId}`);
      return await supabase.rpc('create_matches_for_quick_tournament', {
        lobby_id: lobbyId
      });
    }, 3, 1000);
    
    if (error) {
      console.error("[TOURNAMENT] Error creating tournament:", error);
      
      // Check if there's a detailed error message we can log
      if (error.message) {
        console.error("[TOURNAMENT] Error message:", error.message);
      }
      
      if (error.code) {
        console.error("[TOURNAMENT] Error code:", error.code);
      }
      
      // Even if RPC failed, let's check if tournament was actually created
      const { data: checkLobby, error: checkError } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (!checkError && checkLobby?.tournament_id) {
        console.log(`[TOURNAMENT] Tournament was actually created: ${checkLobby.tournament_id}`);
        return { allReady: true, tournamentId: checkLobby.tournament_id };
      }
      
      // Try direct tournament creation as a fallback
      return await forceTournamentCreation(lobbyId);
    }
    
    // Add a delay to ensure tournament is created
    await delay(1000);
    
    // Get the tournament ID that was created
    const { data: updatedLobby, error: updateError2 } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, status')
      .eq('id', lobbyId)
      .single();
    
    if (updateError2) {
      console.error("[TOURNAMENT] Error getting tournament ID:", updateError2);
      return { allReady: true, tournamentId: null };
    }
    
    if (!updatedLobby?.tournament_id) {
      console.error("[TOURNAMENT] Tournament not created");
      return await forceTournamentCreation(lobbyId);
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
};

/**
 * Force tournament creation as a fallback
 */
const forceTournamentCreation = async (lobbyId: string) => {
  try {
    console.log(`[TOURNAMENT] Attempting direct tournament creation for lobby ${lobbyId}`);
    
    // Get participants to check if we have 4 players
    const { data: participants } = await supabase
      .from('lobby_participants')
      .select('user_id')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready', 'searching']);
      
    if (!participants || participants.length < 4) {
      console.error(`[TOURNAMENT] Not enough participants: ${participants?.length || 0}`);
      return { allReady: true, tournamentId: null };
    }
    
    // Create tournament directly
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
      console.error("[TOURNAMENT] Error creating tournament directly:", tournamentError);
      return { allReady: true, tournamentId: null };
    }
    
    // Update lobby with tournament ID
    await supabase
      .from('tournament_lobbies')
      .update({ 
        tournament_id: tournament.id, 
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', lobbyId);
      
    // Add participants
    for (const participant of participants) {
      await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          user_id: participant.user_id,
          status: 'active',
          points: 0
        });
    }
    
    // Create matches (round-robin)
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        await supabase
          .from('matches')
          .insert({
            tournament_id: tournament.id,
            player1_id: participants[i].user_id,
            player2_id: participants[j].user_id,
            status: 'scheduled'
          });
      }
    }
    
    console.log(`[TOURNAMENT] Tournament created manually! ID: ${tournament.id}`);
    return { allReady: true, tournamentId: tournament.id };
  } catch (error) {
    console.error("[TOURNAMENT] Error in forceTournamentCreation:", error);
    return { allReady: true, tournamentId: null };
  }
};
