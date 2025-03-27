
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

// Исправим проблему с множественным созданием турниров
export const cleanupDuplicateTournaments = async () => {
  try {
    console.log(`[TOURNAMENT-SERVICE] Cleaning up duplicate tournaments`);
    
    // Получаем список лобби с несколькими турнирами
    const { data, error } = await supabase
      .from('tournament_lobbies')
      .select('id, tournament_id, created_at');
      
    if (error) {
      console.error(`[TOURNAMENT-SERVICE] Error fetching lobbies:`, error);
      throw error;
    }
    
    // Группировка лобби по ID для поиска дубликатов
    const lobbiesMap = data.reduce((acc, lobby) => {
      if (!acc[lobby.id]) {
        acc[lobby.id] = [];
      }
      if (lobby.tournament_id) {
        acc[lobby.id].push(lobby.tournament_id);
      }
      return acc;
    }, {} as Record<string, string[]>);
    
    // Для каждого лобби с более чем одним турниром, оставляем только самый старый
    let cleanupCount = 0;
    for (const [lobbyId, tournamentIds] of Object.entries(lobbiesMap)) {
      if (tournamentIds.length > 1) {
        console.log(`[TOURNAMENT-SERVICE] Lobby ${lobbyId} has ${tournamentIds.length} tournaments, cleaning up...`);
        
        // Получаем информацию о всех турнирах для этого лобби
        const { data: tournaments } = await supabase
          .from('tournaments')
          .select('id, created_at')
          .in('id', tournamentIds)
          .order('created_at', { ascending: true });
          
        if (tournaments && tournaments.length > 1) {
          // Оставляем самый первый турнир, остальные помечаем как завершенные
          const [keepTournamentId, ...duplicateTournamentIds] = tournaments.map(t => t.id);
          
          console.log(`[TOURNAMENT-SERVICE] Keeping tournament ${keepTournamentId}, marking ${duplicateTournamentIds.length} as completed`);
          
          // Помечаем дубликаты как завершенные
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
          
          // Обновляем лобби, чтобы оно указывало только на основной турнир
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

// Для анализа причин создания множества турниров
export const analyzeTournamentCreation = async () => {
  try {
    // Анализируем создание турниров по времени для выявления паттернов
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, created_at, lobby_id, status')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) {
      throw error;
    }
    
    // Группируем по лобби
    const byLobby = data.reduce((acc, tournament) => {
      if (tournament.lobby_id) {
        if (!acc[tournament.lobby_id]) {
          acc[tournament.lobby_id] = [];
        }
        acc[tournament.lobby_id].push(tournament);
      }
      return acc;
    }, {} as Record<string, any[]>);
    
    // Анализируем паттерны времени создания
    const duplicationPatterns: Record<string, any> = {};
    let totalDuplicates = 0;
    
    for (const [lobbyId, tournaments] of Object.entries(byLobby)) {
      if (tournaments.length > 1) {
        // Сортируем по времени создания
        tournaments.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        // Вычисляем временные интервалы между созданиями
        const intervals = [];
        for (let i = 1; i < tournaments.length; i++) {
          const interval = (
            new Date(tournaments[i].created_at).getTime() - 
            new Date(tournaments[i-1].created_at).getTime()
          ) / 1000; // в секундах
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
  
  // Check if user meets qualification rating
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
  
  // Register user for tournament
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
  
  // Increment current participants count
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
