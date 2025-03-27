
import { supabase } from "@/integrations/supabase/client";
import { withRetry, cleanupStaleLobbyParticipation, updateLobbyPlayerCount, delay } from "../utils";
import { leaveQuickTournament } from "./leaveService";

// Helper function for debugging errors in different environments
const logError = (context: string, error: any) => {
  const isProduction = window.location.hostname !== 'localhost' && 
                      !window.location.hostname.includes('preview--');
  
  console.error(`[TOURNAMENT] Error in ${context}:`, error);
  
  // In production, add more detail to help diagnose issues
  if (isProduction) {
    console.error(`[TOURNAMENT] Error details for ${context}:`, {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
  }
};

/**
 * Search for an available quick tournament or create a new one
 */
export const searchForQuickTournament = async () => {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error("Необходимо авторизоваться для участия в турнирах");
    }
    
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
      
    if (existingError) {
      logError("checking existing participation", existingError);
    }
      
    if (existingParticipation) {
      console.log(`[TOURNAMENT] User ${user.user.id} is already in lobby ${existingParticipation.lobby_id} with status ${existingParticipation.status}`);
      
      // Check if the lobby is still valid
      const { data: lobby, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('id, status, current_players, tournament_id, created_at')
        .eq('id', existingParticipation.lobby_id)
        .maybeSingle();
        
      if (lobbyError) {
        logError("checking existing lobby", lobbyError);
      }
        
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
          return { lobbyId: existingParticipation.lobby_id };
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
          
          return { lobbyId: existingParticipation.lobby_id };
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
    
    // Create a new lobby or find an existing one with retry logic
    const findLobby = async (retries = 2): Promise<string> => {
      try {
        console.log("[TOURNAMENT] Calling match_players_for_quick_tournament function");
        
        // Call RPC function without timestamp parameters
        const { data, error } = await supabase.rpc('match_players_for_quick_tournament');
        
        if (error) {
          logError("match_players_for_quick_tournament", error);
          throw error;
        }
        
        if (!data) {
          console.error("[TOURNAMENT] No lobby ID returned from match_players_for_quick_tournament");
          throw new Error("Сервер не вернул ID лобби. Пожалуйста, попробуйте снова.");
        }
        
        return data;
      } catch (error) {
        if (retries > 0) {
          console.log(`[TOURNAMENT] Retrying match_players call, ${retries} retries left`);
          await delay(1000);
          return findLobby(retries - 1);
        }
        throw error;
      }
    };
    
    // Try to find or create a lobby
    const lobbyId = await findLobby();
    console.log(`[TOURNAMENT] User ${user.user.id} matched to lobby: ${lobbyId}`);
    
    // Check if the user is already in this lobby
    const { data: existingParticipant, error: checkError } = await supabase
      .from('lobby_participants')
      .select('id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .maybeSingle();
    
    if (checkError) {
      logError("checking participant", checkError);
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
          logError("updating participant status", updateError);
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
        logError("joining lobby", joinError);
        throw new Error("Не удалось присоединиться к турниру. Пожалуйста, попробуйте снова.");
      }
    }
    
    // Update the lobby's current_players count
    await updateLobbyPlayerCount(lobbyId);
    
    return { lobbyId };
  } catch (error) {
    logError("searchForQuickTournament", error);
    throw error;
  }
};
