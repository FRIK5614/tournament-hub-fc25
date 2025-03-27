
import { supabase } from "@/integrations/supabase/client";
import { delay } from "../utils";
import { updateLobbyPlayerCount } from "@/hooks/tournament-search/utils";

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
export const updateLobbyPlayerCount = async (lobbyId: string) => {
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
      participants?.map(p => ({ id: p.user_id, status: p.status, ready: p.is_ready })));
    
    // Update lobby player count
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
        .select('status, tournament_id')
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
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error("Необходимо авторизоваться для участия в турнирах");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} searching for quick tournament`);
    
    // First, clean up any stale lobbies for this user
    await cleanupStaleLobbyParticipation(user.user.id);
    
    // Try to find or create a lobby with retry
    const findLobbyWithRetry = async (maxRetries = 3): Promise<string> => {
      let retries = 0;
      
      while (retries <= maxRetries) {
        try {
          console.log(`[TOURNAMENT] Attempt ${retries + 1} to find/create lobby`);
          
          // Call RPC function to match players
          const { data, error } = await supabase.rpc('match_players_for_quick_tournament');
          
          if (error) {
            console.error(`[TOURNAMENT] Error on attempt ${retries + 1}:`, error);
            throw error;
          }
          
          if (!data) {
            throw new Error("Сервер не вернул ID лобби");
          }
          
          console.log(`[TOURNAMENT] Successfully found/created lobby: ${data}`);
          return data;
        } catch (err) {
          retries++;
          
          if (retries > maxRetries) {
            throw err;
          }
          
          // Wait before retrying
          console.log(`[TOURNAMENT] Retrying in 1 second (${retries}/${maxRetries})`);
          await delay(1000);
        }
      }
      
      throw new Error("Exceeded maximum retries");
    };
    
    // Try to find or create a lobby
    const lobbyId = await findLobbyWithRetry();
    console.log(`[TOURNAMENT] User ${user.user.id} matched to lobby: ${lobbyId}`);
    
    // Get lobby status
    const { data: lobbyData, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players')
      .eq('id', lobbyId)
      .single();
      
    if (lobbyError) {
      console.error(`[TOURNAMENT] Error fetching lobby data:`, lobbyError);
      throw lobbyError;
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
    
    // Check if the user is already in this lobby
    const { data: existingParticipant, error: participantError } = await supabase
      .from('lobby_participants')
      .select('id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .maybeSingle();
    
    if (participantError) {
      console.error(`[TOURNAMENT] Error checking existing participation:`, participantError);
    }
    
    if (existingParticipant) {
      console.log(`[TOURNAMENT] User ${user.user.id} already in lobby ${lobbyId} with status: ${existingParticipant.status}`);
      
      // If the participant exists but status is incorrect, update their status
      if (existingParticipant.status !== initialStatus) {
        const { error: updateError } = await supabase
          .from('lobby_participants')
          .update({
            status: initialStatus,
            is_ready: false
          })
          .eq('id', existingParticipant.id);
          
        if (updateError) {
          console.error(`[TOURNAMENT] Error updating participant status:`, updateError);
        } else {
          console.log(`[TOURNAMENT] Updated participant ${existingParticipant.id} status to '${initialStatus}'`);
        }
      }
    } else {
      console.log(`[TOURNAMENT] Adding user ${user.user.id} to lobby ${lobbyId}`);
      
      // Add player to the new lobby
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
    
    // Explicitly check if lobby is in ready_check status and ensure all participants have status = 'ready'
    if (lobbyData?.status === 'ready_check') {
      console.log(`[TOURNAMENT] Synchronizing all participants to 'ready' status for ready check`);
      await supabase
        .from('lobby_participants')
        .update({ status: 'ready' })
        .eq('lobby_id', lobbyId)
        .eq('status', 'searching');
    }
    
    // Update the lobby's current_players count - force this to update after user was added
    await updateLobbyPlayerCount(lobbyId);
    
    // Add a slight delay and verify the player was added correctly
    await delay(1000);
    
    const { data: verifyParticipant } = await supabase
      .from('lobby_participants')
      .select('id, status')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .maybeSingle();
      
    if (!verifyParticipant) {
      console.warn(`[TOURNAMENT] Player doesn't appear to be in lobby after addition, retrying`);
      
      // Try to add again if verification failed
      await supabase
        .from('lobby_participants')
        .insert({
          lobby_id: lobbyId,
          user_id: user.user.id,
          status: initialStatus,
          is_ready: false
        });
        
      // Note: Removed the onConflict() method which was causing the TypeScript error
    }
    
    // Force update player count one more time to ensure accuracy
    await updateLobbyPlayerCount(lobbyId);
    
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
    
    // Mark player as having left
    await supabase
      .from('lobby_participants')
      .update({ status: 'left' })
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id);
      
    // Update lobby player count
    await updateLobbyPlayerCount(lobbyId);
    
    console.log(`[TOURNAMENT] User ${user.user.id} successfully left lobby ${lobbyId}`);
    return { success: true };
  } catch (error) {
    logError("leaveQuickTournament", error);
    throw error;
  }
};
