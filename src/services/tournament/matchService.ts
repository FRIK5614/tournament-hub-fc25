
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "./utils";
import type { Match } from "./index";

/**
 * Get matches for a specific player within a tournament
 */
export const getPlayerMatches = async (tournamentId: string, playerId: string) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:player1_id(id, username, avatar_url),
        player2:player2_id(id, username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
      
    if (error) {
      console.error('[MATCH] Error getting player matches:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('[MATCH] Error in getPlayerMatches:', error);
    throw error;
  }
};

/**
 * Get a single match by ID
 */
export const getMatchById = async (matchId: string) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:player1_id(id, username, avatar_url, rating),
        player2:player2_id(id, username, avatar_url, rating)
      `)
      .eq('id', matchId)
      .single();
      
    if (error) {
      console.error('[MATCH] Error getting match by ID:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('[MATCH] Error in getMatchById:', error);
    throw error;
  }
};

/**
 * Submit match result
 */
export const submitMatchResult = async (
  matchId: string, 
  player1Score: number, 
  player2Score: number, 
  submitterId: string
) => {
  try {
    // Get the match first to determine if submitter is player1 or player2
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('player1_id, player2_id, status')
      .eq('id', matchId)
      .single();
      
    if (matchError) {
      console.error('[MATCH] Error getting match for result submission:', matchError);
      throw matchError;
    }
    
    if (match.status === 'completed') {
      throw new Error('Матч уже завершен');
    }
    
    const isPlayer1 = match.player1_id === submitterId;
    const isPlayer2 = match.player2_id === submitterId;
    
    if (!isPlayer1 && !isPlayer2) {
      throw new Error('Вы не являетесь участником этого матча');
    }
    
    // Determine the winner based on scores
    const winnerId = player1Score > player2Score ? match.player1_id : match.player2_id;
    
    // Update match with results
    const updateData: any = {
      player1_score: player1Score,
      player2_score: player2Score,
      winner_id: winnerId,
      status: 'awaiting_confirmation'
    };
    
    // If player 1 is submitting, mark player1_confirmed
    if (isPlayer1) {
      updateData.result_confirmed_by_player2 = false;
    } else {
      // If player 2 is submitting, mark player2_confirmed
      updateData.result_confirmed_by_player2 = true;
    }
    
    const { error: updateError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', matchId);
      
    if (updateError) {
      console.error('[MATCH] Error updating match with result:', updateError);
      throw updateError;
    }
    
    return {
      success: true,
      message: 'Результат успешно отправлен'
    };
  } catch (error: any) {
    console.error('[MATCH] Error in submitMatchResult:', error);
    throw error;
  }
};

/**
 * Confirm match result
 */
export const confirmMatchResult = async (matchId: string, playerId: string) => {
  try {
    // Get the match first
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();
      
    if (matchError) {
      console.error('[MATCH] Error getting match for confirmation:', matchError);
      throw matchError;
    }
    
    if (match.status === 'completed') {
      throw new Error('Матч уже завершен');
    }
    
    if (match.status !== 'awaiting_confirmation') {
      throw new Error('Матч не ожидает подтверждения результата');
    }
    
    const isPlayer1 = match.player1_id === playerId;
    const isPlayer2 = match.player2_id === playerId;
    
    if (!isPlayer1 && !isPlayer2) {
      throw new Error('Вы не являетесь участником этого матча');
    }
    
    // If player1 is confirming and they submitted the result, or 
    // player2 is confirming and they submitted the result, that's an error
    if ((isPlayer1 && !match.result_confirmed_by_player2) || 
        (isPlayer2 && match.result_confirmed_by_player2)) {
      throw new Error('Вы не можете подтвердить свой собственный результат');
    }
    
    // Update match as confirmed
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'completed',
        result_confirmed: true,
        completed_time: new Date().toISOString()
      })
      .eq('id', matchId);
      
    if (updateError) {
      console.error('[MATCH] Error confirming match result:', updateError);
      throw updateError;
    }
    
    // Update tournament standings
    await updateTournamentStandings(match.tournament_id, match.winner_id);
    
    return {
      success: true,
      message: 'Результат матча подтвержден'
    };
  } catch (error: any) {
    console.error('[MATCH] Error in confirmMatchResult:', error);
    throw error;
  }
};

/**
 * Reject match result
 */
export const rejectMatchResult = async (matchId: string, playerId: string) => {
  try {
    // Get the match first
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();
      
    if (matchError) {
      console.error('[MATCH] Error getting match for rejection:', matchError);
      throw matchError;
    }
    
    if (match.status === 'completed') {
      throw new Error('Матч уже завершен');
    }
    
    if (match.status !== 'awaiting_confirmation') {
      throw new Error('Матч не ожидает подтверждения результата');
    }
    
    const isPlayer1 = match.player1_id === playerId;
    const isPlayer2 = match.player2_id === playerId;
    
    if (!isPlayer1 && !isPlayer2) {
      throw new Error('Вы не являетесь участником этого матча');
    }
    
    // Reset match to scheduled state
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'scheduled',
        player1_score: null,
        player2_score: null,
        winner_id: null,
        result_confirmed: false,
        result_confirmed_by_player2: false
      })
      .eq('id', matchId);
      
    if (updateError) {
      console.error('[MATCH] Error rejecting match result:', updateError);
      throw updateError;
    }
    
    return {
      success: true,
      message: 'Результат матча отклонен'
    };
  } catch (error: any) {
    console.error('[MATCH] Error in rejectMatchResult:', error);
    throw error;
  }
};

/**
 * Update tournament standings based on match results
 */
export const updateTournamentStandings = async (tournamentId: string, winnerId: string) => {
  try {
    // Add points to the winner
    const { error: updateError } = await supabase
      .from('tournament_participants')
      .update({ points: supabase.rpc('increment', { count: 3 }) })
      .eq('tournament_id', tournamentId)
      .eq('user_id', winnerId);
      
    if (updateError) {
      console.error('[MATCH] Error updating tournament standings:', updateError);
      throw updateError;
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('[MATCH] Error in updateTournamentStandings:', error);
    throw error;
  }
};

/**
 * Get tournament standings
 */
export const getTournamentStandings = async (tournamentId: string) => {
  try {
    const { data, error } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        user:user_id(id, username, avatar_url, rating)
      `)
      .eq('tournament_id', tournamentId)
      .order('points', { ascending: false });
      
    if (error) {
      console.error('[MATCH] Error getting tournament standings:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('[MATCH] Error in getTournamentStandings:', error);
    throw error;
  }
};

// Fix multiple tournament creation issue by implementing a utility service
export const cleanupDuplicateTournaments = async () => {
  try {
    // 1. Find duplicates by lobby_id
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    // Build a map of lobby_id to tournaments
    const lobbyMap = new Map();
    const duplicates = [];
    
    for (const tournament of tournaments || []) {
      if (!tournament.lobby_id) continue;
      
      if (lobbyMap.has(tournament.lobby_id)) {
        // This is a duplicate
        duplicates.push(tournament.id);
      } else {
        lobbyMap.set(tournament.lobby_id, tournament.id);
      }
    }
    
    console.log(`Found ${duplicates.length} duplicate tournaments`);
    
    // Update tournament lobbies to point to the first tournament
    for (const [lobbyId, tournamentId] of lobbyMap.entries()) {
      await supabase
        .from('tournament_lobbies')
        .update({ tournament_id: tournamentId })
        .eq('id', lobbyId);
    }
    
    // Mark duplicates as "cancelled"
    let cleanedCount = 0;
    if (duplicates.length > 0) {
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ status: 'cancelled' })
        .in('id', duplicates);
        
      if (!updateError) {
        cleanedCount = duplicates.length;
      }
    }
    
    return {
      cleanedUp: cleanedCount,
      totalDuplicates: duplicates.length
    };
  } catch (error) {
    console.error('[TOURNAMENT] Error cleaning up duplicates:', error);
    throw error;
  }
};

// Analyze tournament creation patterns to diagnose issues
export const analyzeTournamentCreation = async () => {
  try {
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('id, lobby_id, created_at, status')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Group by lobby_id
    const lobbyGroups = new Map();
    let totalDuplicates = 0;
    
    // Tournaments with no lobby_id
    const orphanedTournaments = [];
    
    for (const tournament of tournaments || []) {
      if (!tournament.lobby_id) {
        orphanedTournaments.push(tournament);
        continue;
      }
      
      if (!lobbyGroups.has(tournament.lobby_id)) {
        lobbyGroups.set(tournament.lobby_id, []);
      }
      
      lobbyGroups.get(tournament.lobby_id).push(tournament);
    }
    
    // Find lobbies with multiple tournaments
    const duplicateGroups = [];
    
    for (const [lobbyId, tournamentList] of lobbyGroups.entries()) {
      if (tournamentList.length > 1) {
        // Sort by creation date for analysis
        tournamentList.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        duplicateGroups.push({
          lobbyId,
          tournaments: tournamentList,
          timeGapMs: tournamentList.length > 1 ? 
            (new Date(tournamentList[1].created_at).getTime() - 
             new Date(tournamentList[0].created_at).getTime()) : 0
        });
        
        totalDuplicates += tournamentList.length - 1;
      }
    }
    
    return {
      total: tournaments?.length || 0,
      orphaned: orphanedTournaments.length,
      duplicateGroups,
      totalDuplicates,
      // Quick stats on time gaps
      timeGapStats: duplicateGroups.length > 0 ? {
        min: Math.min(...duplicateGroups.map(g => g.timeGapMs)),
        max: Math.max(...duplicateGroups.map(g => g.timeGapMs)),
        avg: duplicateGroups.reduce((sum, g) => sum + g.timeGapMs, 0) / duplicateGroups.length
      } : null
    };
  } catch (error) {
    console.error('[TOURNAMENT] Error analyzing tournaments:', error);
    throw error;
  }
};
