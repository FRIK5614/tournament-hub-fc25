
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
    
    // Update tournament participants count
    await supabase
      .from('tournaments')
      .update({ current_participants: supabase.rpc('increment', { count: 1 }) })
      .eq('id', tournamentId);
      
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
    // Call the RPC function
    const { error } = await supabase.rpc('cleanup_duplicate_tournaments');
    
    if (error) throw error;
    
    return { success: true, message: "Успешно очищены дублирующиеся турниры" };
  } catch (error: any) {
    console.error("Error cleaning up tournaments:", error);
    throw new Error(`Ошибка при очистке турниров: ${error.message}`);
  }
};

// Analyze tournament creation for duplicates
export const analyzeTournamentCreation = async () => {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('lobby_id, count(*)')
      .not('lobby_id', 'is', null)
      .group('lobby_id')
      .having('count(*)', 'gt', 1);
      
    if (error) throw error;
    
    let totalDuplicates = 0;
    const duplicateSets = [];
    
    for (const row of data || []) {
      const { data: details } = await supabase
        .from('tournaments')
        .select('id, title, created_at')
        .eq('lobby_id', row.lobby_id)
        .order('created_at', { ascending: true });
        
      if (details && details.length > 1) {
        duplicateSets.push({
          lobbyId: row.lobby_id,
          count: details.length,
          tournaments: details
        });
        totalDuplicates += details.length - 1;
      }
    }
    
    return {
      totalDuplicates,
      duplicateSets,
      hasIssues: totalDuplicates > 0
    };
  } catch (error: any) {
    console.error("Error analyzing tournaments:", error);
    throw new Error(`Ошибка при анализе создания турниров: ${error.message}`);
  }
};
