
import { supabase } from "@/integrations/supabase/client";

/**
 * Get the current status of a tournament lobby
 */
export const getLobbyStatus = async (lobbyId: string) => {
  try {
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
  } catch (error) {
    console.error("[TOURNAMENT] Error in getLobbyStatus:", error);
    throw error;
  }
};
