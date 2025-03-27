
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
    
    // Try to create tournament
    const { error: rpcError } = await supabase.rpc('create_matches_for_quick_tournament', {
      lobby_id: lobbyId
    });
    
    if (rpcError) {
      console.error("[TOURNAMENT] Error creating tournament via RPC:", rpcError);
      throw rpcError;
    }
    
    // Check if tournament was created successfully
    const { data: updatedLobby } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (!updatedLobby?.tournament_id) {
      throw new Error("Турнир не был создан");
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
    
    // Get participants for this lobby
    const { data: participants } = await supabase
      .from('lobby_participants')
      .select('user_id, profile:profiles(id, username, avatar_url)')
      .eq('lobby_id', lobbyId)
      .in('status', ['ready', 'searching']);
      
    if (!participants || participants.length < 4) {
      throw new Error(`Недостаточно участников для создания турнира: ${participants?.length || 0}/4`);
    }
    
    // Create tournament
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
      throw tournamentError;
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
