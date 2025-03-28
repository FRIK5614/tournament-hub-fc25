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
    
    // Update tournament participants count - we'll use a direct update instead of RPC
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ current_participants: supabase.rpc('get_participant_count', { t_id: tournamentId }) })
      .eq('id', tournamentId);
      
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
    // First, get all tournaments with lobby_id
    const { data: tournaments, error: fetchError } = await supabase
      .from('tournaments')
      .select('id, lobby_id, created_at')
      .not('lobby_id', 'is', null)
      .order('created_at', { ascending: true });
    
    if (fetchError) throw fetchError;
    
    if (!tournaments || tournaments.length <= 1) {
      return { 
        success: true, 
        message: "Нет дублирующихся турниров для очистки", 
        cleanedUp: 0 
      };
    }
    
    // Keep the first tournament for each lobby_id
    const tournamentsToKeep = new Set<string>();
    const lobbySeen = new Set<string>();
    const tournamentsToDelete: string[] = [];
    
    tournaments.forEach(tournament => {
      const lobbyId = tournament.lobby_id;
      if (lobbyId && !lobbySeen.has(lobbyId)) {
        lobbySeen.add(lobbyId);
        tournamentsToKeep.add(tournament.id);
      } else if (lobbyId) {
        tournamentsToDelete.push(tournament.id);
      }
    });
    
    if (tournamentsToDelete.length === 0) {
      return { 
        success: true, 
        message: "Нет дублирующихся турниров для очистки", 
        cleanedUp: 0 
      };
    }
    
    // Delete the tournaments that are duplicates
    const { data, error } = await supabase
      .from('tournaments')
      .delete()
      .in('id', tournamentsToDelete)
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
    // First, fetch all tournaments with lobby_id
    const { data: tournaments, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, lobby_id, created_at')
      .not('lobby_id', 'is', null)
      .order('created_at', { ascending: true });
      
    if (tournamentError) throw tournamentError;
    
    // Process the results to find duplicates - client-side grouping
    const lobbyMap: Record<string, { count: number; tournaments: any[] }> = {};
    
    tournaments?.forEach(tournament => {
      if (tournament.lobby_id) {
        if (!lobbyMap[tournament.lobby_id]) {
          lobbyMap[tournament.lobby_id] = { count: 0, tournaments: [] };
        }
        
        lobbyMap[tournament.lobby_id].count++;
        lobbyMap[tournament.lobby_id].tournaments.push(tournament);
      }
    });
    
    // Filter to lobbies with more than one tournament
    const duplicateLobbyIds = Object.entries(lobbyMap)
      .filter(([_, data]) => data.count >= 2)
      .map(([lobbyId, data]) => ({ lobby_id: lobbyId, count: data.count }));
      
    let totalDuplicates = 0;
    const duplicateSets = [];
    const duplicationPatterns = {};
    
    // Get detailed data about each duplicate set
    for (const item of duplicateLobbyIds || []) {
      if (!item.lobby_id) continue;
      
      const tournaments = lobbyMap[item.lobby_id].tournaments;
      
      if (tournaments && tournaments.length > 1) {
        // Calculate time differences between creations
        const timeIntervals = [];
        for (let i = 1; i < tournaments.length; i++) {
          const prev = new Date(tournaments[i-1].created_at).getTime();
          const curr = new Date(tournaments[i].created_at).getTime();
          timeIntervals.push((curr - prev) / 1000); // in seconds
        }
        
        const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
        
        duplicationPatterns[item.lobby_id] = {
          count: tournaments.length,
          avgInterval,
          timestamps: tournaments.map(d => d.created_at)
        };
        
        duplicateSets.push({
          lobbyId: item.lobby_id,
          count: tournaments.length,
          tournaments: tournaments
        });
        
        totalDuplicates += tournaments.length - 1; // Count all but the first as duplicates
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
