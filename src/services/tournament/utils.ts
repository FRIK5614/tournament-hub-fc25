
import { supabase } from "@/integrations/supabase/client";

// Maximum number of retry attempts for various operations
export const MAX_RETRIES = 3;
// Delay between retries in milliseconds
export const RETRY_DELAY = 1000;

// Helper function to delay execution
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry a function with exponential backoff
export async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delayMs = RETRY_DELAY): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[TOURNAMENT] Operation failed, retries left: ${retries}`, error);
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
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players, max_players, tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (lobbyError) {
      console.error("[TOURNAMENT] Error fetching lobby info:", lobbyError);
      return;
    }
      
    // Check if lobby has a tournament already - if so, don't mess with the status
    if (lobby?.tournament_id) {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} already has tournament ${lobby.tournament_id}, skipping status update`);
      return;
    }
    
    // Update the lobby's current_players count with retry logic
    try {
      await withRetry(async () => {
        const { error: updateError } = await supabase
          .from('tournament_lobbies')
          .update({ current_players: activeCount })
          .eq('id', lobbyId);
          
        if (updateError) {
          console.error("[TOURNAMENT] Error updating lobby player count:", updateError);
          throw updateError;
        }
        return { success: true };
      }, 2);
    } catch (updateError) {
      console.error("[TOURNAMENT] Failed to update lobby player count after retries:", updateError);
      // Continue with status transitions even if update failed
    }
    
    // Status transitions based on player count
    if (activeCount === 4) {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} has 4 players, starting ready check`);
      
      // Only update to ready_check if we're in waiting state
      if (lobby?.status === 'waiting') {
        try {
          await withRetry(async () => {
            const { error: statusError } = await supabase
              .from('tournament_lobbies')
              .update({ 
                status: 'ready_check',
                ready_check_started_at: new Date().toISOString()
              })
              .eq('id', lobbyId);
              
            if (statusError) {
              console.error("[TOURNAMENT] Error updating lobby status to ready_check:", statusError);
              throw statusError;
            }
            return { success: true };
          }, 2);
        } catch (statusError) {
          console.error("[TOURNAMENT] Failed to update lobby status after retries:", statusError);
        }
      }
    } else if (activeCount < 4) {
      // If we have less than 4 players and status was ready_check, revert to waiting
      if (lobby?.status === 'ready_check') {
        console.log(`[TOURNAMENT] Lobby ${lobbyId} no longer has 4 players, reverting to waiting status`);
        
        try {
          await withRetry(async () => {
            const { error: revertError } = await supabase
              .from('tournament_lobbies')
              .update({ 
                status: 'waiting', 
                ready_check_started_at: null 
              })
              .eq('id', lobbyId);
              
            if (revertError) {
              console.error("[TOURNAMENT] Error reverting lobby status to waiting:", revertError);
              throw revertError;
            }
            return { success: true };
          }, 2);
          
          // Also reset any ready players
          await withRetry(async () => {
            const { error: resetError } = await supabase
              .from('lobby_participants')
              .update({ 
                status: 'searching', 
                is_ready: false 
              })
              .eq('lobby_id', lobbyId)
              .eq('status', 'ready');
              
            if (resetError) {
              console.error("[TOURNAMENT] Error resetting player ready status:", resetError);
              throw resetError;
            }
            return { success: true };
          }, 2);
        } catch (error) {
          console.error("[TOURNAMENT] Failed to revert lobby status after retries:", error);
        }
      }
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in updateLobbyPlayerCount:", error);
  }
};

// Clean up any stale lobby participations for a user
export async function cleanupStaleLobbies(userId: string) {
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
        
        try {
          await withRetry(async () => {
            const { error: leaveError } = await supabase
              .from('lobby_participants')
              .update({ status: 'left', is_ready: false })
              .eq('id', participation.id);
              
            if (leaveError) {
              console.error("[TOURNAMENT] Error marking user as left:", leaveError);
              throw leaveError;
            }
            return { success: true };
          }, 2);
          
          // Update lobby counts
          if (lobby) {
            await updateLobbyPlayerCount(participation.lobby_id);
          }
        } catch (leaveError) {
          console.error("[TOURNAMENT] Failed to cleanup stale participation after retries:", leaveError);
        }
      }
    }
  } catch (err) {
    console.error("[TOURNAMENT] Error cleaning up stale participations:", err);
    // Don't throw - this is a helper function
  }
}
