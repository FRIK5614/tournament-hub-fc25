
import { supabase } from "@/integrations/supabase/client";

// Get tournament standings
export const getTournamentStandings = async (tournamentId: string) => {
  try {
    console.log(`[SERVICE] Getting standings for tournament: ${tournamentId}`);
    
    const { data, error } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        user:user_id(id, username, avatar_url, rating)
      `)
      .eq('tournament_id', tournamentId)
      .order('points', { ascending: false });
      
    if (error) throw error;
    
    console.log(`[SERVICE] Got ${data?.length || 0} standings`);
    return data;
  } catch (error: any) {
    console.error("[SERVICE] Error getting tournament standings:", error);
    throw new Error(`Не удалось получить турнирную таблицу: ${error.message}`);
  }
};

// Get player matches
export const getPlayerMatches = async (tournamentId: string, userId: string) => {
  try {
    console.log(`[SERVICE] Getting matches for player ${userId} in tournament ${tournamentId}`);
    
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:player1_id(id, username, avatar_url, rating),
        player2:player2_id(id, username, avatar_url, rating)
      `)
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    console.log(`[SERVICE] Got ${data?.length || 0} matches for player`);
    return data;
  } catch (error: any) {
    console.error("[SERVICE] Error getting player matches:", error);
    throw new Error(`Не удалось получить матчи игрока: ${error.message}`);
  }
};

// Register for long-term tournament
export const registerForLongTermTournament = async (tournamentId: string) => {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error("Необходимо авторизоваться для регистрации на турнир");
    }
    
    // Check if user is already registered
    const { data: existingRegistration } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.user.id)
      .maybeSingle();
      
    if (existingRegistration) {
      throw new Error("Вы уже зарегистрированы на этот турнир");
    }
    
    // Register for tournament
    const { error } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: user.user.id,
        status: 'registered',
        points: 0
      });
      
    if (error) throw error;
    
    // Update tournament participants count using a direct query instead of sql function
    const { error: updateError } = await supabase.rpc(
      'increment_tournament_participants',
      { tournament_id: tournamentId }
    ).single();
      
    if (updateError) throw updateError;
      
    return { success: true };
  } catch (error: any) {
    console.error("Error registering for tournament:", error);
    throw new Error(`Не удалось зарегистрироваться на турнир: ${error.message}`);
  }
};

// Get long-term tournaments
export const getLongTermTournaments = async () => {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .in('tournament_format', ['conference', 'europa', 'champions'])
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return data || [];
  } catch (error: any) {
    console.error("Error getting long-term tournaments:", error);
    throw new Error(`Не удалось получить список долгосрочных турниров: ${error.message}`);
  }
};

// Clean up duplicates
export const cleanupDuplicateTournaments = async () => {
  try {
    // Use a subquery approach that works with the TypeScript types
    const { data: duplicateIds } = await supabase
      .from('tournaments')
      .select('id')
      .not('lobby_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1000)
      .offset(1);
    
    if (!duplicateIds || duplicateIds.length === 0) {
      return { 
        success: true, 
        message: "Нет дублирующихся турниров для очистки", 
        cleanedUp: 0 
      };
    }
    
    // Extract just the IDs into an array
    const idsToDelete = duplicateIds.map(t => t.id);
    
    // Delete the tournaments with these IDs
    const { data, error } = await supabase
      .from('tournaments')
      .delete()
      .in('id', idsToDelete)
      .select();
    
    if (error) throw error;
    
    const cleanedUp = data?.length || 0;
    
    return { 
      success: true, 
      message: "Успешно очищены дублирующиеся турниры", 
      cleanedUp 
    };
  } catch (error: any) {
    console.error("Error cleaning up tournaments:", error);
    throw new Error(`Ошибка при очистке турниров: ${error.message}`);
  }
};

// Analyze tournament creation for duplicates
export const analyzeTournamentCreation = async () => {
  try {
    // First, find lobbies that have more than one tournament
    const { data: duplicateLobbyIds, error: lobbyError } = await supabase
      .from('tournaments')
      .select('lobby_id, count(*)')
      .not('lobby_id', 'is', null)
      .group('lobby_id')
      .gte('count', 2);
      
    if (lobbyError) throw lobbyError;
    
    let totalDuplicates = 0;
    const duplicateSets = [];
    const duplicationPatterns = {};
    
    // Get detailed data about each duplicate set
    for (const item of duplicateLobbyIds || []) {
      if (!item.lobby_id) continue;
      
      const { data: details } = await supabase
        .from('tournaments')
        .select('id, title, created_at')
        .eq('lobby_id', item.lobby_id)
        .order('created_at', { ascending: true });
        
      if (details && details.length > 1) {
        // Calculate time differences between creations
        const timeIntervals = [];
        for (let i = 1; i < details.length; i++) {
          const prev = new Date(details[i-1].created_at).getTime();
          const curr = new Date(details[i].created_at).getTime();
          timeIntervals.push((curr - prev) / 1000); // in seconds
        }
        
        const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
        
        duplicationPatterns[item.lobby_id] = {
          count: details.length,
          avgInterval,
          timestamps: details.map(d => d.created_at)
        };
        
        duplicateSets.push({
          lobbyId: item.lobby_id,
          count: details.length,
          tournaments: details
        });
        
        totalDuplicates += details.length - 1; // Count all but the first as duplicates
      }
    }
    
    // Get total analyzed count
    const { count: totalAnalyzed } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true });
    
    return {
      totalDuplicates,
      totalAnalyzed,
      duplicateSets,
      duplicationPatterns,
      hasIssues: totalDuplicates > 0
    };
  } catch (error: any) {
    console.error("Error analyzing tournaments:", error);
    throw new Error(`Ошибка при анализе создания турниров: ${error.message}`);
  }
};
