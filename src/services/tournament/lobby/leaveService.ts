
import { supabase } from "@/integrations/supabase/client";
import { updateLobbyPlayerCount } from "../utils";

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
