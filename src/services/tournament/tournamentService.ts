import { supabase } from "@/integrations/supabase/client";

export const getTournamentStandings = async (tournamentId: string) => {
  try {
    console.log(`[TOURNAMENT-SERVICE] Getting standings for tournament ${tournamentId}`);
    
    const { data, error } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        user:user_id(id, username, avatar_url, rating, platform)
      `)
      .eq('tournament_id', tournamentId)
      .order('points', { ascending: false });
    
    if (error) {
      console.error(`[TOURNAMENT-SERVICE] Error loading standings:`, error);
      throw error;
    }
    
    console.log(`[TOURNAMENT-SERVICE] Successfully loaded ${data?.length || 0} participants for standings`);
    return data || [];
  } catch (error: any) {
    console.error(`[TOURNAMENT-SERVICE] Error in getTournamentStandings:`, error);
    throw new Error(`Не удалось получить турнирную таблицу: ${error.message}`);
  }
};

export const getPlayerMatches = async (tournamentId: string, playerId: string) => {
  try {
    console.log(`[TOURNAMENT-SERVICE] Getting matches for player ${playerId} in tournament ${tournamentId}`);
    
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:player1_id(id, username, avatar_url, rating),
        player2:player2_id(id, username, avatar_url, rating)
      `)
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error(`[TOURNAMENT-SERVICE] Error fetching player matches:`, error);
      throw error;
    }
    
    console.log(`[TOURNAMENT-SERVICE] Successfully loaded ${data?.length || 0} matches for player`);
    return data || [];
  } catch (error: any) {
    console.error(`[TOURNAMENT-SERVICE] Error in getPlayerMatches:`, error);
    throw new Error(`Не удалось получить матчи игрока: ${error.message}`);
  }
};

export const cleanupDuplicateTournaments = async () => {
  try {
    console.log(`[TOURNAMENT-SERVICE] Cleaning up duplicate tournaments`);
    
    const { data, error } = await supabase
      .from('tournament_lobbies')
      .select('id, tournament_id, created_at');
      
    if (error) {
      console.error(`[TOURNAMENT-SERVICE] Error fetching lobbies:`, error);
      throw error;
    }
    
    const lobbiesMap = data.reduce((acc, lobby) => {
      if (!acc[lobby.id]) {
        acc[lobby.id] = [];
      }
      if (lobby.tournament_id) {
        acc[lobby.id].push(lobby.tournament_id);
      }
      return acc;
    }, {} as Record<string, string[]>);
    
    let cleanupCount = 0;
    for (const [lobbyId, tournamentIds] of Object.entries(lobbiesMap)) {
      if (tournamentIds.length > 1) {
        console.log(`[TOURNAMENT-SERVICE] Lobby ${lobbyId} has ${tournamentIds.length} tournaments, cleaning up...`);
        
        const { data: tournaments } = await supabase
          .from('tournaments')
          .select('id, created_at')
          .in('id', tournamentIds)
          .order('created_at', { ascending: true });
          
        if (tournaments && tournaments.length > 1) {
          const [keepTournamentId, ...duplicateTournamentIds] = tournaments.map(t => t.id);
          
          console.log(`[TOURNAMENT-SERVICE] Keeping tournament ${keepTournamentId}, marking ${duplicateTournamentIds.length} as completed`);
          
          for (const duplicateId of duplicateTournamentIds) {
            await supabase
              .from('tournaments')
              .update({ 
                status: 'completed',
                updated_at: new Date().toISOString(),
                description: 'Автоматически завершен как дубликат'
              })
              .eq('id', duplicateId);
              
            cleanupCount++;
          }
          
          await supabase
            .from('tournament_lobbies')
            .update({ tournament_id: keepTournamentId })
            .eq('id', lobbyId);
        }
      }
    }
    
    console.log(`[TOURNAMENT-SERVICE] Cleanup completed, fixed ${cleanupCount} duplicate tournaments`);
    return { cleanedUp: cleanupCount };
  } catch (error: any) {
    console.error(`[TOURNAMENT-SERVICE] Error in cleanupDuplicateTournaments:`, error);
    throw error;
  }
};

export const analyzeTournamentCreation = async () => {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, created_at, lobby_id, status')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) {
      throw error;
    }
    
    const byLobby = data.reduce((acc, tournament) => {
      if (tournament.lobby_id) {
        if (!acc[tournament.lobby_id]) {
          acc[tournament.lobby_id] = [];
        }
        acc[tournament.lobby_id].push(tournament);
      }
      return acc;
    }, {} as Record<string, any[]>);
    
    const duplicationPatterns: Record<string, any> = {};
    let totalDuplicates = 0;
    
    for (const [lobbyId, tournaments] of Object.entries(byLobby)) {
      if (tournaments.length > 1) {
        tournaments.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        const intervals = [];
        for (let i = 1; i < tournaments.length; i++) {
          const interval = (
            new Date(tournaments[i].created_at).getTime() - 
            new Date(tournaments[i-1].created_at).getTime()
          ) / 1000;
          intervals.push(interval);
        }
        
        duplicationPatterns[lobbyId] = {
          count: tournaments.length,
          intervals,
          avgInterval: intervals.reduce((sum, val) => sum + val, 0) / intervals.length
        };
        
        totalDuplicates += tournaments.length - 1;
      }
    }
    
    return {
      totalAnalyzed: data.length,
      totalDuplicates,
      duplicationPatterns,
      byLobby
    };
  } catch (error: any) {
    console.error(`[TOURNAMENT-SERVICE] Error analyzing tournament creation:`, error);
    throw error;
  }
};

export const getLongTermTournaments = async () => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('tournament_format', ['conference', 'europa', 'champions'])
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Ошибка при получении списка турниров:", error);
    throw new Error("Не удалось получить список турниров. Пожалуйста, попробуйте снова.");
  }
  
  return data;
};

export const registerForLongTermTournament = async (tournamentId: string) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для регистрации на турнир");
  }
  
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  
  if (tournamentError || !tournament) {
    throw new Error("Турнир не найден");
  }
  
  if (tournament.qualification_rating) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rating')
      .eq('id', user.user.id)
      .single();
    
    if (profileError || !profile) {
      throw new Error("Не удалось получить информацию о вашем профиле");
    }
    
    if (profile.rating < tournament.qualification_rating) {
      throw new Error(`Для участия в этом турнире требуется рейтинг не менее ${tournament.qualification_rating}. Ваш текущий рейтинг: ${profile.rating}`);
    }
  }
  
  const { error } = await supabase
    .from('tournament_participants')
    .insert({
      tournament_id: tournamentId,
      user_id: user.user.id,
      status: 'registered'
    });
  
  if (error) {
    console.error("Ошибка при регистрации на турнир:", error);
    throw new Error("Не удалось зарегистрироваться на турнир. Возможно, вы уже зарегистрированы.");
  }
  
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({
      current_participants: tournament.current_participants + 1
    })
    .eq('id', tournamentId);
  
  if (updateError) {
    console.error("Ошибка при обновлении количества участников:", updateError);
  }
  
  return true;
};
