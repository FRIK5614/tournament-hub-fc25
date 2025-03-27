
import { supabase } from "@/integrations/supabase/client";

// Maximum number of retry attempts for various operations
export const MAX_RETRIES = 3;
// Delay between retries in milliseconds
export const RETRY_DELAY = 1000;

// Helper function to delay execution
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry a function with exponential backoff
export async function withRetry<T>(fn: () => Promise<any>, retries = MAX_RETRIES, delayMs = RETRY_DELAY): Promise<any> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await delay(delayMs);
      return withRetry(fn, retries - 1, delayMs * 1.5);
    }
    throw error;
  }
}

// Update the lobby's current_players count and manage lobby status
export const updateLobbyPlayerCount = async (lobbyId: string) => {
  try {
    // Get the current active participants count (only searching or ready players)
    const { data: participants, error: countError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error counting participants:", countError);
      return;
    }
    
    const activeCount = participants?.length || 0;
    console.log(`[TOURNAMENT] Lobby ${lobbyId} has ${activeCount} active participants`);
    
    if (participants) {
      console.log(`[TOURNAMENT] Participants in lobby ${lobbyId}:`, participants.map(p => ({ 
        id: p.user_id, 
        status: p.status, 
        ready: p.is_ready 
      })));
    }
    
    // Get lobby information
    const { data: lobby } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players, max_players, tournament_id')
      .eq('id', lobbyId)
      .single();
      
    // Check if lobby has a tournament already - if so, don't mess with the status
    if (lobby?.tournament_id) {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} already has tournament ${lobby.tournament_id}, skipping status update`);
      return;
    }
    
    // Update the lobby's current_players count
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: activeCount })
      .eq('id', lobbyId);
      
    if (updateError) {
      console.error("[TOURNAMENT] Error updating lobby player count:", updateError);
    }
    
    // Status transitions based on player count
    if (activeCount === 4) {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} has 4 players, starting ready check`);
      
      // Only update to ready_check if we're in waiting state
      if (lobby?.status === 'waiting') {
        const { error: statusError } = await supabase
          .from('tournament_lobbies')
          .update({ 
            status: 'ready_check',
            ready_check_started_at: new Date().toISOString()
          })
          .eq('id', lobbyId);
          
        if (statusError) {
          console.error("[TOURNAMENT] Error updating lobby status to ready_check:", statusError);
        }
      }
    } else if (activeCount < 4) {
      // If we have less than 4 players and status was ready_check, revert to waiting
      if (lobby?.status === 'ready_check') {
        console.log(`[TOURNAMENT] Lobby ${lobbyId} no longer has 4 players, reverting to waiting status`);
        
        await supabase
          .from('tournament_lobbies')
          .update({ 
            status: 'waiting', 
            ready_check_started_at: null 
          })
          .eq('id', lobbyId);
          
        // Also reset any ready players
        await supabase
          .from('lobby_participants')
          .update({ 
            status: 'searching', 
            is_ready: false 
          })
          .eq('lobby_id', lobbyId)
          .eq('status', 'ready');
      }
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in updateLobbyPlayerCount:", error);
  }
};

// Clean up any stale lobby participations for a user
export async function cleanupStaleLobbyParticipation(userId: string) {
  try {
    console.log(`[TOURNAMENT] Cleaning up stale lobby participations for user ${userId}`);
    
    // Get all active participations for this user
    const { data: participations, error } = await supabase
      .from('lobby_participants')
      .select('id, lobby_id, created_at')
      .eq('user_id', userId)
      .in('status', ['searching', 'ready']);
      
    if (error || !participations || participations.length === 0) {
      return;
    }
    
    console.log(`[TOURNAMENT] Found ${participations.length} active participations for user ${userId}`);
    
    // Check each lobby to see if it's still valid
    for (const participation of participations) {
      const { data: lobby } = await supabase
        .from('tournament_lobbies')
        .select('id, status, tournament_id, created_at')
        .eq('id', participation.lobby_id)
        .maybeSingle();
        
      // If lobby doesn't exist or is too old or has a tournament already
      if (!lobby || 
          lobby.tournament_id || 
          new Date(lobby.created_at).getTime() < Date.now() - 20 * 60 * 1000) {
        
        console.log(`[TOURNAMENT] Marking user ${userId} as left from stale lobby ${participation.lobby_id}`);
        
        await supabase
          .from('lobby_participants')
          .update({ status: 'left', is_ready: false })
          .eq('id', participation.id);
          
        // Update lobby counts
        if (lobby) {
          await updateLobbyPlayerCount(participation.lobby_id);
        }
      }
    }
  } catch (err) {
    console.error("[TOURNAMENT] Error cleaning up stale participations:", err);
    // Don't throw - this is a helper function
  }
}
