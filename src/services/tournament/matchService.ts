import { supabase } from "@/integrations/supabase/client";

// Fix the RPC call to properly handle tournament chat messages
export const postTournamentChatMessage = async (tournamentId: string, message: string) => {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error("Необходимо авторизоваться для отправки сообщений");
    }
    
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        tournament_id: tournamentId,
        user_id: user.user.id,
        message
      });
      
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error("Error posting chat message:", error);
    throw new Error(`Не удалось отправить сообщение: ${error.message}`);
  }
};

export const getTournamentChatMessages = async (tournamentId: string) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:user_id(id, username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    return data || [];
  } catch (error: any) {
    console.error("Error fetching chat messages:", error);
    throw new Error(`Не удалось загрузить сообщения чата: ${error.message}`);
  }
};

// Add any other match-related services here
// Correctly call the RPC function without attempting to assign its return value
export const createMatchesForTournament = async (lobbyId: string) => {
  try {
    const { error } = await supabase.rpc('create_matches_for_quick_tournament', { lobby_id: lobbyId });
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Error creating matches:", error);
    throw new Error(`Не удалось создать матчи для турнира: ${error.message}`);
  }
};
