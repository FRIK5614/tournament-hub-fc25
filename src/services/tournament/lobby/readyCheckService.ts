
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
      console.log(`[TOURNAMENT] All players are ready in lobby ${lobbyId}. Attempting to create tournament.`);
      
      // Try to directly create the tournament instead of waiting for the trigger
      try {
        // First check if tournament already exists (double-check)
        const { data: updatedLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .single();
          
        if (updatedLobby?.tournament_id) {
          console.log(`[TOURNAMENT] Tournament was already created for lobby ${lobbyId}: ${updatedLobby.tournament_id}`);
          return { 
            ready: true, 
            allReady: true,
            tournamentId: updatedLobby.tournament_id 
          };
        }
        
        // Force the tournament creation by calling the RPC function directly
        const { data: tournamentData, error: createError } = await supabase.rpc('create_matches_for_quick_tournament', {
          lobby_id: lobbyId
        });
        
        if (createError) {
          console.error("[TOURNAMENT] Error creating tournament via RPC:", createError);
          
          // Fallback: Check if tournament was created despite error
          const { data: checkLobby } = await supabase
            .from('tournament_lobbies')
            .select('tournament_id')
            .eq('id', lobbyId)
            .single();
            
          if (checkLobby?.tournament_id) {
            console.log(`[TOURNAMENT] Tournament exists despite RPC error: ${checkLobby.tournament_id}`);
            return { 
              ready: true, 
              allReady: true,
              tournamentId: checkLobby.tournament_id 
            };
          }
          
          throw createError;
        }
        
        console.log(`[TOURNAMENT] Tournament successfully created for lobby ${lobbyId}`);
        
        // Get the tournament_id that was created
        const { data: finalLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .single();
          
        if (finalLobby?.tournament_id) {
          return { 
            ready: true, 
            allReady: true,
            tournamentId: finalLobby.tournament_id 
          };
        } else {
          console.log(`[TOURNAMENT] Tournament creation successful but couldn't get ID`);
          return { ready: true, allReady: true, tournamentId: null };
        }
      } catch (error) {
        console.error("[TOURNAMENT] Error in tournament creation:", error);
        // Still return ready=true since the user is ready, even if tournament creation failed
        return { ready: true, allReady: true, tournamentId: null };
      }
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
