
import { supabase } from "@/integrations/supabase/client";

export const getPlayerMatches = async (tournamentId: string, userId: string) => {
  try {
    console.log(`[TOURNAMENT-SERVICE] Getting matches for player ${userId} in tournament ${tournamentId}`);
    
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:player1_id(id, username, avatar_url),
        player2:player2_id(id, username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error(`[TOURNAMENT-SERVICE] Error loading player matches:`, error);
      throw error;
    }
    
    console.log(`[TOURNAMENT-SERVICE] Successfully loaded ${data?.length || 0} matches for player`);
    return data || [];
  } catch (error: any) {
    console.error(`[TOURNAMENT-SERVICE] Error in getPlayerMatches:`, error);
    throw new Error(`Не удалось получить матчи: ${error.message}`);
  }
};

export const submitMatchResult = async (matchId: string, userId: string, player1Score: number, player2Score: number) => {
  try {
    console.log(`[TOURNAMENT-SERVICE] Submitting match result for match ${matchId}`);
    
    // Проверяем, что пользователь участвует в матче
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();
      
    if (matchError) {
      console.error(`[TOURNAMENT-SERVICE] Error loading match data:`, matchError);
      throw matchError;
    }
    
    if (match.player1_id !== userId && match.player2_id !== userId) {
      throw new Error("Вы не являетесь участником этого матча");
    }
    
    // Определяем, является ли пользователь игроком 1 или 2
    const isPlayer1 = match.player1_id === userId;
    
    // В зависимости от игрока обновляем соответствующие поля
    if (isPlayer1) {
      const { error } = await supabase
        .from('matches')
        .update({
          player1_score: player1Score,
          player2_score: player2Score,
          status: 'awaiting_confirmation'
        })
        .eq('id', matchId);
        
      if (error) {
        console.error(`[TOURNAMENT-SERVICE] Error submitting result:`, error);
        throw error;
      }
    } else {
      // Игрок 2 подтверждает результат
      const winnerId = player1Score > player2Score 
        ? match.player1_id 
        : player2Score > player1Score 
          ? match.player2_id 
          : null; // Ничья
      
      const { error } = await supabase
        .from('matches')
        .update({
          player1_score: player1Score,
          player2_score: player2Score,
          status: 'completed',
          result_confirmed: true,
          result_confirmed_by_player2: true,
          winner_id: winnerId,
          completed_time: new Date().toISOString()
        })
        .eq('id', matchId);
        
      if (error) {
        console.error(`[TOURNAMENT-SERVICE] Error confirming result:`, error);
        throw error;
      }
      
      // После подтверждения результата начисляем очки победителю
      if (winnerId) {
        const { error: pointsError } = await supabase
          .from('tournament_participants')
          .update({ points: match.is_final ? 6 : 3 })
          .eq('tournament_id', match.tournament_id)
          .eq('user_id', winnerId);
          
        if (pointsError) {
          console.error(`[TOURNAMENT-SERVICE] Error updating points:`, pointsError);
        }
      }
    }
    
    console.log(`[TOURNAMENT-SERVICE] Match result successfully submitted`);
    return { success: true };
  } catch (error: any) {
    console.error(`[TOURNAMENT-SERVICE] Error in submitMatchResult:`, error);
    throw new Error(`Не удалось отправить результат: ${error.message}`);
  }
};

export const confirmMatchResult = async (matchId: string, userId: string, accept: boolean) => {
  try {
    console.log(`[TOURNAMENT-SERVICE] ${accept ? 'Confirming' : 'Rejecting'} match result for match ${matchId}`);
    
    // Проверяем, что пользователь участвует в матче и результат ожидает подтверждения
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .eq('status', 'awaiting_confirmation')
      .single();
      
    if (matchError) {
      console.error(`[TOURNAMENT-SERVICE] Error loading match data:`, matchError);
      throw matchError;
    }
    
    if (match.player2_id !== userId) {
      throw new Error("Только игрок 2 может подтвердить результат");
    }
    
    if (accept) {
      // Подтверждаем результат
      const winnerId = match.player1_score > match.player2_score 
        ? match.player1_id 
        : match.player2_score > match.player1_score 
          ? match.player2_id 
          : null; // Ничья
      
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'completed',
          result_confirmed: true,
          result_confirmed_by_player2: true,
          winner_id: winnerId,
          completed_time: new Date().toISOString()
        })
        .eq('id', matchId);
        
      if (error) {
        console.error(`[TOURNAMENT-SERVICE] Error confirming result:`, error);
        throw error;
      }
      
      // После подтверждения результата начисляем очки победителю
      if (winnerId) {
        const { error: pointsError } = await supabase
          .from('tournament_participants')
          .update({ points: match.is_final ? 6 : 3 })
          .eq('tournament_id', match.tournament_id)
          .eq('user_id', winnerId);
          
        if (pointsError) {
          console.error(`[TOURNAMENT-SERVICE] Error updating points:`, pointsError);
        }
      }
    } else {
      // Отклоняем результат и возвращаем матч в статус "scheduled"
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'scheduled',
          player1_score: null,
          player2_score: null,
          result_confirmed: false,
          result_confirmed_by_player2: false,
          winner_id: null
        })
        .eq('id', matchId);
        
      if (error) {
        console.error(`[TOURNAMENT-SERVICE] Error rejecting result:`, error);
        throw error;
      }
    }
    
    console.log(`[TOURNAMENT-SERVICE] Match result successfully ${accept ? 'confirmed' : 'rejected'}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[TOURNAMENT-SERVICE] Error in confirmMatchResult:`, error);
    throw new Error(`Не удалось ${accept ? 'подтвердить' : 'отклонить'} результат: ${error.message}`);
  }
};
