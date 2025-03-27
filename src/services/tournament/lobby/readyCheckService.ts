
import { supabase } from "@/integrations/supabase/client";

/**
 * Mark a user as ready in a tournament lobby
 */
export const markUserAsReady = async (lobbyId: string) => {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error("Необходимо авторизоваться для участия в турнирах");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} marking as ready in lobby ${lobbyId}`);
    
    // First verify this lobby is in ready_check state
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
      throw new Error("Не удалось подтвердить готовность");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} successfully marked as ready`);
    
    // Check if all players are ready
    const { data: participants } = await supabase
      .from('lobby_participants')
      .select('id, user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (!participants) {
      return { ready: true, allReady: false, tournamentId: null };
    }
    
    // Count ready players
    const readyPlayers = participants.filter(p => p.is_ready).length;
    const totalPlayers = participants.length;
    
    console.log(`[TOURNAMENT] Lobby ${lobbyId} has ${readyPlayers}/${totalPlayers} ready players`);
    
    // If all players are ready and there are 4 of them, attempt to create tournament
    const allReady = readyPlayers === 4 && totalPlayers === 4;
    
    if (allReady) {
      console.log(`[TOURNAMENT] All players are ready in lobby ${lobbyId}. Tournament should be created automatically.`);
      
      // Check if tournament exists after a delay to give the database trigger time to work
      setTimeout(async () => {
        const { data: updatedLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .single();
          
        if (!updatedLobby?.tournament_id) {
          console.log(`[TOURNAMENT] No tournament created yet for lobby ${lobbyId}, forcing creation`);
          
          try {
            // Force the tournament creation by calling the RPC function directly
            await supabase.rpc('create_matches_for_quick_tournament', {
              lobby_id: lobbyId
            });
            
            console.log(`[TOURNAMENT] Forced tournament creation for lobby ${lobbyId}`);
          } catch (error) {
            console.error("[TOURNAMENT] Error forcing tournament creation:", error);
          }
        }
      }, 2000);
    }
    
    return { 
      ready: true, 
      allReady: allReady,
      tournamentId: null
    };
  } catch (error) {
    console.error("[TOURNAMENT] Error in markUserAsReady:", error);
    throw error;
  }
};
