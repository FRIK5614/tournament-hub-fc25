
import { supabase } from "@/integrations/supabase/client";
import { updateLobbyPlayerCount } from "../utils";

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
    
    // If all players are ready and there are exactly 4 of them, attempt to create tournament
    const allReady = readyPlayers === 4 && totalPlayers === 4;
    
    if (allReady) {
      console.log(`[TOURNAMENT] All players are ready in lobby ${lobbyId}. Attempting to create tournament.`);
      
      // Try to directly create the tournament - more aggressive approach with retry logic
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
        
        // Force the tournament creation by calling the RPC function directly with multiple retries
        let createError = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          console.log(`[TOURNAMENT] Attempt ${retryCount + 1} to create tournament via RPC for lobby ${lobbyId}`);
          
          const { data: tournamentData, error: rpcError } = await supabase.rpc('create_matches_for_quick_tournament', {
            lobby_id: lobbyId
          });
          
          if (!rpcError) {
            console.log(`[TOURNAMENT] Tournament successfully created on attempt ${retryCount + 1}`);
            break;
          } else {
            console.error(`[TOURNAMENT] Error on attempt ${retryCount + 1}:`, rpcError);
            createError = rpcError;
            retryCount++;
            
            // Small delay before retry
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        // Check if the tournament was created after all the retries
        const { data: finalLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .single();
          
        if (finalLobby?.tournament_id) {
          console.log(`[TOURNAMENT] Tournament created for lobby ${lobbyId}: ${finalLobby.tournament_id}`);
          return { 
            ready: true, 
            allReady: true,
            tournamentId: finalLobby.tournament_id 
          };
        }
        
        // If we're here and createError exists, throw it to trigger the manual creation
        if (createError) {
          throw createError;
        }
        
        // If we get here, something is wrong but no specific error was thrown
        console.log(`[TOURNAMENT] Unable to create tournament after ${maxRetries} attempts`);
        return { 
          ready: true, 
          allReady: true,
          tournamentId: null 
        };
      } catch (error) {
        console.error("[TOURNAMENT] Error in tournament creation via RPC:", error);
        
        // Fallback: Try to manually create the tournament if RPC fails
        try {
          console.log(`[TOURNAMENT] Attempting manual tournament creation for lobby ${lobbyId}`);
          
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
            console.error("[TOURNAMENT] Error creating tournament manually:", tournamentError);
            
            // Check one more time if tournament was created by someone else
            const { data: checkLobby } = await supabase
              .from('tournament_lobbies')
              .select('tournament_id')
              .eq('id', lobbyId)
              .single();
              
            if (checkLobby?.tournament_id) {
              console.log(`[TOURNAMENT] Tournament exists despite creation error: ${checkLobby.tournament_id}`);
              return { 
                ready: true, 
                allReady: true,
                tournamentId: checkLobby.tournament_id 
              };
            }
            
            // Nothing worked, return null tournament id
            return { ready: true, allReady: true, tournamentId: null };
          }
          
          const tournamentId = tournament.id;
          console.log(`[TOURNAMENT] Tournament manually created: ${tournamentId}`);
          
          // Update lobby with tournament ID
          await supabase
            .from('tournament_lobbies')
            .update({
              tournament_id: tournamentId,
              status: 'active',
              started_at: new Date().toISOString()
            })
            .eq('id', lobbyId);
            
          // Add participants
          for (const participant of participants) {
            await supabase
              .from('tournament_participants')
              .insert({
                tournament_id: tournamentId,
                user_id: participant.user_id,
                status: 'active',
                points: 0
              });
          }
          
          // Create matches (round-robin)
          const playerIds = participants.map(p => p.user_id);
          for (let i = 0; i < playerIds.length; i++) {
            for (let j = i + 1; j < playerIds.length; j++) {
              await supabase
                .from('matches')
                .insert({
                  tournament_id: tournamentId,
                  player1_id: playerIds[i],
                  player2_id: playerIds[j],
                  status: 'scheduled'
                });
            }
          }
          
          return { 
            ready: true, 
            allReady: true,
            tournamentId: tournamentId 
          };
        } catch (manualError) {
          console.error("[TOURNAMENT] Error in manual tournament creation:", manualError);
          return { ready: true, allReady: true, tournamentId: null };
        }
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
