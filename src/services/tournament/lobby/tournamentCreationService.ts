
import { supabase } from "@/integrations/supabase/client";

/**
 * Create a tournament for a lobby by calling the RPC function
 */
export const createTournamentViaRPC = async (lobbyId: string) => {
  try {
    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (existingLobby?.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists: ${existingLobby.tournament_id}`);
      return { tournamentId: existingLobby.tournament_id, created: false };
    }
    
    // Verify authentication before creating tournament
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("[TOURNAMENT] Authentication error:", authError);
      throw new Error("Убедитесь, что вы авторизованы для создания турнира");
    }
    
    console.log(`[TOURNAMENT] Attempting to create tournament via RPC as user ${authData.user.id}`);
    
    // Try to create tournament
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_matches_for_quick_tournament', {
      lobby_id: lobbyId
    });
    
    if (rpcError) {
      console.error("[TOURNAMENT] Error creating tournament via RPC:", rpcError);
      // Более подробная информация об ошибке для отладки
      if (rpcError.code === "42501") { // Код ошибки доступа в PostgreSQL
        console.error("[TOURNAMENT] Permission denied - row level security violation");
      }
      throw rpcError;
    }
    
    console.log(`[TOURNAMENT] RPC execution successful:`, rpcData);
    
    // Check if tournament was created successfully
    const { data: updatedLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (!updatedLobby?.tournament_id) {
      throw new Error("Турнир не был создан при выполнении RPC");
    }
    
    console.log(`[TOURNAMENT] Tournament created via RPC: ${updatedLobby.tournament_id}`);
    return { tournamentId: updatedLobby.tournament_id, created: true };
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentViaRPC:", error);
    throw error;
  }
};

/**
 * Create a tournament manually when RPC fails
 */
export const createTournamentManually = async (lobbyId: string) => {
  try {
    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (existingLobby?.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists: ${existingLobby.tournament_id}`);
      return { tournamentId: existingLobby.tournament_id, created: false };
    }
    
    // Verify authentication before creating tournament
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("[TOURNAMENT] Authentication error:", authError);
      throw new Error("Убедитесь, что вы авторизованы для создания турнира");
    }
    
    console.log(`[TOURNAMENT] Creating tournament manually as user ${authData.user.id}`);
    
    // Get participants for this lobby
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('user_id, profile:profiles(id, username, avatar_url)')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready', 'searching']);
      
    if (participantsError) {
      console.error("[TOURNAMENT] Error fetching participants:", participantsError);
      throw participantsError;
    }
      
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    console.log(`[TOURNAMENT] Creating tournament with ${participants.length} participants`);
    
    // Create tournament with service role key if admin, otherwise try without
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
      if (tournamentError.code === "42501") { // Код ошибки доступа в PostgreSQL
        console.error("[TOURNAMENT] Permission denied during tournament creation - check RLS policies");
      }
      throw tournamentError;
    }
    
    const tournamentId = tournament.id;
    console.log(`[TOURNAMENT] Tournament manually created: ${tournamentId}`);
    
    // Update lobby with tournament ID
    const { error: updateLobbyError } = await supabase
      .from('tournament_lobbies')
      .update({
        tournament_id: tournamentId,
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', lobbyId);
      
    if (updateLobbyError) {
      console.error("[TOURNAMENT] Error updating lobby with tournament ID:", updateLobbyError);
      throw updateLobbyError;
    }
      
    // Add participants
    for (const participant of participants) {
      const { error: participantError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          user_id: participant.user_id,
          status: 'active',
          points: 0
        });
        
      if (participantError) {
        console.error(`[TOURNAMENT] Error adding participant ${participant.user_id}:`, participantError);
        // Продолжаем с другими участниками
      }
    }
    
    return { tournamentId, created: true };
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentManually:", error);
    throw error;
  }
};

/**
 * Create a tournament with retry logic
 */
export const createTournamentWithRetry = async (lobbyId: string) => {
  try {
    // First check if tournament already exists
    const { data: existingLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (existingLobby?.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists: ${existingLobby.tournament_id}`);
      return { tournamentId: existingLobby.tournament_id, created: false };
    }
    
    // Сначала проверим, все ли игроки действительно готовы
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('user_id, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready', 'searching']);
      
    if (participantsError) {
      console.error("[TOURNAMENT] Error checking participants:", participantsError);
      throw participantsError;
    }
    
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    const readyCount = participants.filter(p => p.is_ready).length;
    if (readyCount < 4) {
      throw new Error(`Не все игроки готовы: ${readyCount}/4`);
    }
    
    // Try RPC first
    try {
      console.log(`[TOURNAMENT] Attempting to create tournament via RPC for lobby ${lobbyId}`);
      return await createTournamentViaRPC(lobbyId);
    } catch (rpcError) {
      console.error("[TOURNAMENT] RPC creation failed, trying manual creation:", rpcError);
      
      // Try manual creation as fallback
      return await createTournamentManually(lobbyId);
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in createTournamentWithRetry:", error);
    throw error;
  }
};
