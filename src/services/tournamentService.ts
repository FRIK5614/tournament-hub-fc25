
import { supabase } from "@/integrations/supabase/client";

export const searchForQuickTournament = async () => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для участия в турнирах");
  }
  
  try {
    // Call the function to get or create a lobby
    const { data, error } = await supabase.rpc('match_players_for_quick_tournament');
    
    if (error) {
      console.error("Ошибка при поиске турнира:", error);
      throw new Error("Не удалось найти турнир. Пожалуйста, попробуйте снова.");
    }
    
    // Add the user to the lobby
    const lobbyId = data;
    console.log("Matched to lobby:", lobbyId);
    
    // Check if the user is already in this lobby
    const { data: existingParticipant, error: checkError } = await supabase
      .from('lobby_participants')
      .select('id')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .maybeSingle();
    
    if (checkError) {
      console.error("Ошибка при проверке участия:", checkError);
    }
    
    if (!existingParticipant) {
      const { error: joinError } = await supabase
        .from('lobby_participants')
        .insert({
          lobby_id: lobbyId,
          user_id: user.user.id,
          status: 'searching'
        });
      
      if (joinError) {
        console.error("Ошибка при присоединении к лобби:", joinError);
        throw new Error("Не удалось присоединиться к турниру. Пожалуйста, попробуйте снова.");
      }
    }
    
    // Fetch the current lobby status to check if ready_check is needed
    const { data: lobbyStatus, error: statusError } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players')
      .eq('id', lobbyId)
      .single();
    
    if (statusError) {
      console.error("Ошибка при получении статуса лобби:", statusError);
    } else {
      console.log("Current lobby status:", lobbyStatus);
    }
    
    return lobbyId;
  } catch (error) {
    console.error("Ошибка в searchForQuickTournament:", error);
    throw error;
  }
};

export const markUserAsReady = async (lobbyId: string) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для участия в турнирах");
  }
  
  const { error } = await supabase
    .from('lobby_participants')
    .update({
      is_ready: true,
      status: 'ready'
    })
    .eq('lobby_id', lobbyId)
    .eq('user_id', user.user.id);
  
  if (error) {
    console.error("Ошибка при подтверждении готовности:", error);
    throw new Error("Не удалось подтвердить готовность. Пожалуйста, попробуйте снова.");
  }
  
  // Directly check if all players are ready and create tournament if needed
  const result = await checkAllPlayersReady(lobbyId);
  console.log("Check all players ready result:", result);
  
  return true;
};

export const checkAllPlayersReady = async (lobbyId: string) => {
  try {
    // Get lobby info first
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('current_players, max_players, status')
      .eq('id', lobbyId)
      .single();
    
    if (lobbyError) {
      console.error("Ошибка при получении информации о лобби:", lobbyError);
      return false;
    }
    
    console.log("Lobby status check:", lobby);
    
    if (lobby.status !== 'ready_check') {
      console.log("Lobby not in ready_check state:", lobby.status);
      return false;
    }
    
    // Get all READY participants in the lobby
    const { data: readyParticipants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('user_id')
      .eq('lobby_id', lobbyId)
      .eq('status', 'ready')
      .eq('is_ready', true);
    
    if (participantsError) {
      console.error("Ошибка при проверке готовности игроков:", participantsError);
      return false;
    }
    
    console.log("Ready players:", readyParticipants?.length, "Total expected:", lobby.max_players);
    
    // Check if we have exactly the right number of players and they're all ready
    if (readyParticipants?.length === lobby.max_players) {
      console.log("All players are ready. Creating tournament...");
      
      // Call the RPC function to create a tournament
      const { data, error } = await supabase.rpc('create_matches_for_quick_tournament', {
        lobby_id: lobbyId
      });
      
      if (error) {
        console.error("Ошибка при создании турнира:", error);
        return false;
      }
      
      console.log("Tournament creation response:", data);
      
      // Get the tournament ID that was created
      const { data: updatedLobby, error: updateError } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id, status')
        .eq('id', lobbyId)
        .single();
      
      if (updateError) {
        console.error("Ошибка при получении ID турнира:", updateError);
        return false;
      }
      
      console.log("Tournament created successfully! ID:", updatedLobby.tournament_id);
      return updatedLobby.tournament_id;
    }
    
    console.log("Not all players are ready yet");
    return false;
  } catch (error) {
    console.error("Ошибка в checkAllPlayersReady:", error);
    return false;
  }
};

export const getLobbyStatus = async (lobbyId: string) => {
  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('*, lobby_participants(*)')
    .eq('id', lobbyId)
    .single();
  
  if (error) {
    console.error("Ошибка при получении статуса лобби:", error);
    throw new Error("Не удалось получить информацию о турнире.");
  }
  
  return data;
};

export const getPlayerMatches = async (tournamentId: string, userId: string) => {
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
    console.error("Ошибка при получении матчей игрока:", error);
    throw new Error("Не удалось получить список матчей. Пожалуйста, попробуйте снова.");
  }
  
  return data;
};

export const submitMatchResult = async (
  matchId: string, 
  player1Score: number, 
  player2Score: number, 
  resultImageUrl: string
) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для отправки результатов");
  }
  
  // Get the match details to check if the user is a participant
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();
  
  if (matchError || !match) {
    throw new Error("Матч не найден");
  }
  
  // Check if the user is a participant
  if (match.player1_id !== user.user.id && match.player2_id !== user.user.id) {
    throw new Error("Вы не являетесь участником этого матча");
  }
  
  // Determine winner
  const winnerId = player1Score > player2Score ? match.player1_id : match.player2_id;
  
  // If user is player1, they're submitting the result
  const isPlayer1 = match.player1_id === user.user.id;
  
  const updateData: {
    player1_score: number;
    player2_score: number;
    result_image_url: string;
    status: string;
    winner_id: string;
    result_confirmed?: boolean;
    result_confirmed_by_player2?: boolean;
  } = {
    player1_score: player1Score,
    player2_score: player2Score,
    result_image_url: resultImageUrl,
    status: 'awaiting_confirmation',
    winner_id: winnerId
  };
  
  // If user is player2 and confirming the result
  if (!isPlayer1 && match.player1_score !== null) {
    updateData.result_confirmed = true;
    updateData.result_confirmed_by_player2 = true;
    updateData.status = 'completed';
  }
  
  const { error } = await supabase
    .from('matches')
    .update(updateData)
    .eq('id', matchId);
  
  if (error) {
    console.error("Ошибка при отправке результатов матча:", error);
    throw new Error("Не удалось отправить результаты матча. Пожалуйста, попробуйте снова.");
  }
  
  return true;
};

export const confirmMatchResult = async (matchId: string, confirm: boolean) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для подтверждения результатов");
  }
  
  // Get the match details
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();
  
  if (matchError || !match) {
    throw new Error("Матч не найден");
  }
  
  // Check if the user is the second player
  if (match.player2_id !== user.user.id) {
    throw new Error("Только второй игрок может подтвердить результат");
  }
  
  if (confirm) {
    const { error } = await supabase
      .from('matches')
      .update({
        result_confirmed: true,
        result_confirmed_by_player2: true,
        status: 'completed'
      })
      .eq('id', matchId);
    
    if (error) {
      console.error("Ошибка при подтверждении результатов:", error);
      throw new Error("Не удалось подтвердить результаты. Пожалуйста, попробуйте снова.");
    }
  } else {
    // If the user rejects the result, reset match
    const { error } = await supabase
      .from('matches')
      .update({
        player1_score: null,
        player2_score: null,
        result_image_url: null,
        winner_id: null,
        status: 'scheduled'
      })
      .eq('id', matchId);
    
    if (error) {
      console.error("Ошибка при отклонении результатов:", error);
      throw new Error("Не удалось отклонить результаты. Пожалуйста, попробуйте снова.");
    }
  }
  
  return true;
};

// Tournament standings/table
export const getTournamentStandings = async (tournamentId: string) => {
  const { data, error } = await supabase
    .from('tournament_participants')
    .select(`
      *,
      user:user_id(id, username, avatar_url, rating, platform)
    `)
    .eq('tournament_id', tournamentId)
    .order('points', { ascending: false });
  
  if (error) {
    console.error("Ошибка при получении турнирной таблицы:", error);
    throw new Error("Не удалось получить турнирную таблицу. Пожалуйста, попробуйте снова.");
  }
  
  return data;
};

// Long-term tournaments
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
