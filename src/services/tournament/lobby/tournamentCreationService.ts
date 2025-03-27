
import { supabase } from "@/integrations/supabase/client";
import { withRetry, delay, RetryOptions } from "../utils";

/**
 * Create a tournament for a lobby by calling the RPC function with improved error handling
 */
export const createTournamentViaRPC = async (lobbyId: string) => {
  try {
    // Check authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("[TOURNAMENT] Authentication error:", authError);
      throw new Error("Authentication required to create a tournament");
    }

    // First, check if tournament already exists
    const { data: existingLobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, max_players, status, current_players')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (lobbyError) {
      console.error("[TOURNAMENT] Error checking existing lobby:", lobbyError);
      throw lobbyError;
    }
    
    if (existingLobby?.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists: ${existingLobby.tournament_id}`);
      return { tournamentId: existingLobby.tournament_id, created: false };
    }

    // Check and update max_players if needed
    if (existingLobby && existingLobby.max_players !== 4) {
      await supabase
        .from('tournament_lobbies')
        .update({ max_players: 4 })
        .eq('id', lobbyId);
    }

    // Count participants directly in the database
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (participantsError) {
      console.error("[TOURNAMENT] Error counting participants:", participantsError);
      throw participantsError;
    }
    
    const participantCount = participants.length;
    console.log(`[TOURNAMENT] Participant count: ${participantCount}/4`);
    
    if (participantCount < 4) {
      throw new Error(`Not enough players to create tournament: ${participantCount}/4`);
    }

    // Update all participants to ready status
    await supabase
      .from('lobby_participants')
      .update({ 
        status: 'ready', 
        is_ready: true 
      })
      .eq('lobby_id', lobbyId);

    // Create tournament with more detailed error handling
    const tournamentData = {
      title: 'Quick Tournament',
      max_participants: 4,
      status: 'active',
      type: 'quick',
      tournament_format: 'quick',
      lobby_id: lobbyId,
      current_participants: participantCount
    };

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert(tournamentData)
      .select('id')
      .single();
      
    if (tournamentError) {
      console.error("[TOURNAMENT] Tournament creation error:", tournamentError);
      throw tournamentError;
    }

    // Update lobby with tournament details
    await supabase
      .from('tournament_lobbies')
      .update({
        tournament_id: tournament.id,
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', lobbyId);

    // Add tournament participants
    const participantInserts = participants.map(participant => ({
      tournament_id: tournament.id,
      user_id: participant.user_id,
      status: 'active',
      points: 0
    }));

    await supabase
      .from('tournament_participants')
      .insert(participantInserts);

    // Create matches between participants
    const matchInserts: any[] = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        matchInserts.push({
          tournament_id: tournament.id,
          player1_id: participants[i].user_id,
          player2_id: participants[j].user_id,
          status: 'scheduled'
        });
      }
    }

    await supabase
      .from('matches')
      .insert(matchInserts);

    console.log(`[TOURNAMENT] Tournament created successfully: ${tournament.id}`);
    return { tournamentId: tournament.id, created: true };

  } catch (error) {
    console.error("[TOURNAMENT] Comprehensive error in tournament creation:", error);
    throw error;
  }
};

// Define retry options
const retryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  jitter: true,
  onRetry: (error, retryCount) => {
    console.warn(`[TOURNAMENT] Retry attempt ${retryCount}:`, error);
  }
};

// Create a proper wrapped function that correctly handles the arguments
export const createTournamentWithRetry = withRetry(createTournamentViaRPC, retryOptions);
