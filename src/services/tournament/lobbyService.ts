
import { supabase } from "@/integrations/supabase/client";
import { withRetry, cleanupStaleLobbyParticipation, updateLobbyPlayerCount, delay } from "./utils";

/**
 * Search for an available quick tournament or create a new one
 */
export const searchForQuickTournament = async () => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для участия в турнирах");
  }
  
  try {
    console.log(`[TOURNAMENT] User ${user.user.id} searching for quick tournament`);
    
    // First, clean up any stale lobbies for this user
    await cleanupStaleLobbyParticipation(user.user.id);
    
    // Check if the user is already in an active lobby
    const { data: existingParticipation, error: existingError } = await supabase
      .from('lobby_participants')
      .select('id, lobby_id, status, is_ready')
      .eq('user_id', user.user.id)
      .in('status', ['searching', 'ready'])
      .maybeSingle();
      
    if (existingParticipation) {
      console.log(`[TOURNAMENT] User ${user.user.id} is already in lobby ${existingParticipation.lobby_id} with status ${existingParticipation.status}`);
      
      // Check if the lobby is still valid
      const { data: lobby, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('id, status, current_players, tournament_id, created_at')
        .eq('id', existingParticipation.lobby_id)
        .maybeSingle();
        
      if (!lobbyError && lobby) {
        // Check if the lobby is too old (more than 15 minutes)
        const lobbyCreatedAt = new Date(lobby.created_at);
        const timeElapsed = Date.now() - lobbyCreatedAt.getTime();
        const isLobbyStale = timeElapsed > 15 * 60 * 1000; // 15 minutes
        
        if (isLobbyStale) {
          console.log(`[TOURNAMENT] Lobby ${existingParticipation.lobby_id} is stale. Leaving and finding a new one.`);
          await leaveQuickTournament(existingParticipation.lobby_id);
        } 
        // If the lobby has a tournament, redirect to it
        else if (lobby.tournament_id) {
          console.log(`[TOURNAMENT] Lobby ${existingParticipation.lobby_id} has an active tournament ${lobby.tournament_id}`);
          return existingParticipation.lobby_id;
        }
        // If the lobby is in waiting/ready_check states and no tournament yet, return to it
        else if ((lobby.status === 'waiting' || lobby.status === 'ready_check') && !lobby.tournament_id) {
          console.log(`[TOURNAMENT] Returning to existing lobby ${existingParticipation.lobby_id} with status ${lobby.status}`);
          
          // Ensure player's status is correct
          if (lobby.status === 'ready_check' && !existingParticipation.is_ready) {
            await supabase
              .from('lobby_participants')
              .update({ status: 'searching', is_ready: false })
              .eq('id', existingParticipation.id);
          }
          
          // Update the lobby's player count for accuracy
          await updateLobbyPlayerCount(existingParticipation.lobby_id);
          
          return existingParticipation.lobby_id;
        } else {
          console.log(`[TOURNAMENT] Previous lobby is invalid or has a tournament. Marking player as 'left'.`);
          // Mark the player as having left this lobby
          await supabase
            .from('lobby_participants')
            .update({ status: 'left' })
            .eq('id', existingParticipation.id);
            
          // Update the lobby player count
          await updateLobbyPlayerCount(existingParticipation.lobby_id);
        }
      } else {
        console.log(`[TOURNAMENT] Previous lobby no longer exists. Cleaning up.`);
        // Mark the player as having left since the lobby doesn't exist
        await supabase
          .from('lobby_participants')
          .update({ status: 'left' })
          .eq('id', existingParticipation.id);
      }
    }
    
    // Call the function to get or create a lobby
    const { data, error } = await withRetry(() => 
      supabase.rpc('match_players_for_quick_tournament')
    );
    
    if (error) {
      console.error("[TOURNAMENT] Error searching for tournament:", error);
      throw new Error("Не удалось найти турнир. Пожалуйста, попробуйте снова.");
    }
    
    // Add the user to the lobby
    const lobbyId = data;
    console.log(`[TOURNAMENT] User ${user.user.id} matched to lobby: ${lobbyId}`);
    
    // Check if the user is already in this lobby
    const { data: existingParticipant, error: checkError } = await supabase
      .from('lobby_participants')
      .select('id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .maybeSingle();
    
    if (checkError) {
      console.error("[TOURNAMENT] Error checking participant:", checkError);
    }
    
    if (existingParticipant) {
      console.log(`[TOURNAMENT] User ${user.user.id} already in lobby ${lobbyId} with status: ${existingParticipant.status}`);
      
      // If the participant exists but left, update their status
      if (existingParticipant.status === 'left') {
        const { error: updateError } = await supabase
          .from('lobby_participants')
          .update({
            status: 'searching',
            is_ready: false
          })
          .eq('id', existingParticipant.id);
          
        if (updateError) {
          console.error("[TOURNAMENT] Error updating participant status:", updateError);
        } else {
          console.log(`[TOURNAMENT] Updated participant ${existingParticipant.id} status to 'searching'`);
        }
      }
    } else {
      console.log(`[TOURNAMENT] Adding user ${user.user.id} to lobby ${lobbyId}`);
      
      // First, ensure player doesn't have other active participations
      await cleanupStaleLobbyParticipation(user.user.id);
      
      // Add player to the new lobby
      const { error: joinError } = await supabase
        .from('lobby_participants')
        .insert({
          lobby_id: lobbyId,
          user_id: user.user.id,
          status: 'searching',
          is_ready: false
        });
      
      if (joinError) {
        console.error("[TOURNAMENT] Error joining lobby:", joinError);
        throw new Error("Не удалось присоединиться к турниру. Пожалуйста, попробуйте снова.");
      }
    }
    
    // Update the lobby's current_players count
    await updateLobbyPlayerCount(lobbyId);
    
    return lobbyId;
  } catch (error) {
    console.error("[TOURNAMENT] Error in searchForQuickTournament:", error);
    throw error;
  }
};

/**
 * Remove a user from a quick tournament lobby
 */
export const leaveQuickTournament = async (lobbyId: string) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для выхода из турнира");
  }
  
  try {
    console.log(`[TOURNAMENT] User ${user.user.id} leaving lobby ${lobbyId}`);
    
    // Check if tournament has already been created
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, status')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (lobbyError) {
      console.error("[TOURNAMENT] Error checking lobby status:", lobbyError);
      return false;
    }
    
    // If a tournament is already active, we can't leave
    if (lobby?.tournament_id && lobby?.status === 'active') {
      console.log(`[TOURNAMENT] Cannot leave active tournament ${lobby.tournament_id}`);
      return false;
    }
    
    // Update the participant status to 'left'
    const { error: updateError } = await supabase
      .from('lobby_participants')
      .update({ status: 'left', is_ready: false })
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id);
      
    if (updateError) {
      console.error("[TOURNAMENT] Error marking participant as left:", updateError);
      return false;
    }
    
    console.log(`[TOURNAMENT] Successfully marked user ${user.user.id} as left from lobby ${lobbyId}`);
    
    // Update the lobby player count
    await updateLobbyPlayerCount(lobbyId);
    
    return true;
  } catch (error) {
    console.error("[TOURNAMENT] Error in leaveQuickTournament:", error);
    return false;
  }
};

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
        
        const result = await withRetry(() => 
          supabase.rpc('create_matches_for_quick_tournament', {
            lobby_id: lobbyId
          })
        );
        
        if (result.error) {
          console.error("[TOURNAMENT] Error creating tournament:", result.error);
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

export const getLobbyStatus = async (lobbyId: string) => {
  const response = await supabase
    .from('tournament_lobbies')
    .select('*, lobby_participants(*)')
    .eq('id', lobbyId)
    .single();
  
  if (response.error) {
    console.error("[TOURNAMENT] Error getting lobby status:", response.error);
    throw new Error("Не удалось получить информацию о турнире.");
  }
  
  return response.data;
};
