import { supabase } from "@/integrations/supabase/client";

export const searchForQuickTournament = async () => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для участия в турнирах");
  }
  
  try {
    console.log(`[TOURNAMENT] User ${user.user.id} searching for quick tournament`);
    
    // First, check if the user is already in an active lobby
    const { data: existingParticipation, error: existingError } = await supabase
      .from('lobby_participants')
      .select('id, lobby_id, status')
      .eq('user_id', user.user.id)
      .in('status', ['searching', 'ready'])
      .maybeSingle();
      
    if (existingParticipation) {
      console.log(`[TOURNAMENT] User ${user.user.id} is already in lobby ${existingParticipation.lobby_id} with status ${existingParticipation.status}`);
      
      // Check if the lobby is still valid
      const { data: lobby, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('id, status, current_players, tournament_id')
        .eq('id', existingParticipation.lobby_id)
        .maybeSingle();
        
      if (!lobbyError && lobby && (lobby.status === 'waiting' || lobby.status === 'ready_check') && !lobby.tournament_id) {
        console.log(`[TOURNAMENT] Returning to existing lobby ${existingParticipation.lobby_id} with status ${lobby.status}`);
        
        // Make sure to correct the player's status in case it got out of sync
        await supabase
          .from('lobby_participants')
          .update({ 
            status: 'searching',  // Reset to searching
            is_ready: false 
          })
          .eq('id', existingParticipation.id);
          
        console.log(`[TOURNAMENT] Reset player ${user.user.id} status to searching in lobby ${existingParticipation.lobby_id}`);
        
        // Update the lobby's player count to ensure accuracy
        await updateLobbyPlayerCount(existingParticipation.lobby_id);
        
        return existingParticipation.lobby_id;
      } else {
        console.log(`[TOURNAMENT] Previous lobby is invalid or has a tournament. Marking player as 'left'.`);
        // Mark the player as having left this lobby
        await supabase
          .from('lobby_participants')
          .update({ status: 'left' })
          .eq('id', existingParticipation.id);
          
        // Make sure to update the lobby player count
        await updateLobbyPlayerCount(existingParticipation.lobby_id);
      }
    }
    
    // Call the function to get or create a lobby
    const { data, error } = await supabase.rpc('match_players_for_quick_tournament');
    
    if (error) {
      console.error("[TOURNAMENT] Error searching for tournament:", error);
      throw new Error("Не удалось найти турнир. Пожалуйста, попробуйте снова.");
    }
    
    // Add the user to the lobby
    const lobbyId = data;
    console.log(`[TOURNAMENT] User ${user.user.id} matched to lobby: ${lobbyId}`);
    
    // Check if the user is already in this lobby
    const { data: existingParticipant, error: checkError } = await supabase
      .from('lobby_participants')
      .select('id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id)
      .maybeSingle();
    
    if (checkError) {
      console.error("[TOURNAMENT] Error checking participant:", checkError);
    }
    
    if (existingParticipant) {
      console.log(`[TOURNAMENT] User ${user.user.id} already in lobby ${lobbyId} with status: ${existingParticipant.status}`);
      
      // If the participant exists but left, update their status
      if (existingParticipant.status === 'left') {
        const { error: updateError } = await supabase
          .from('lobby_participants')
          .update({
            status: 'searching',
            is_ready: false
          })
          .eq('id', existingParticipant.id);
          
        if (updateError) {
          console.error("[TOURNAMENT] Error updating participant status:", updateError);
        } else {
          console.log(`[TOURNAMENT] Updated participant ${existingParticipant.id} status to 'searching'`);
        }
      }
    } else {
      console.log(`[TOURNAMENT] Adding user ${user.user.id} to lobby ${lobbyId}`);
      const { error: joinError } = await supabase
        .from('lobby_participants')
        .insert({
          lobby_id: lobbyId,
          user_id: user.user.id,
          status: 'searching',
          is_ready: false
        });
      
      if (joinError) {
        console.error("[TOURNAMENT] Error joining lobby:", joinError);
        throw new Error("Не удалось присоединиться к турниру. Пожалуйста, попробуйте снова.");
      }
    }
    
    // Update the lobby's current_players count
    await updateLobbyPlayerCount(lobbyId);
    
    return lobbyId;
  } catch (error) {
    console.error("[TOURNAMENT] Error in searchForQuickTournament:", error);
    throw error;
  }
};

export const leaveQuickTournament = async (lobbyId: string) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для выхода из турнира");
  }
  
  try {
    console.log(`[TOURNAMENT] User ${user.user.id} leaving lobby ${lobbyId}`);
    
    // Check if tournament has already been created
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('tournament_id, status')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (lobbyError) {
      console.error("[TOURNAMENT] Error checking lobby status:", lobbyError);
      return false;
    }
    
    // If a tournament is already active, we can't leave
    if (lobby?.tournament_id && lobby?.status === 'active') {
      console.log(`[TOURNAMENT] Cannot leave active tournament ${lobby.tournament_id}`);
      return false;
    }
    
    // Update the participant status to 'left'
    const { error: updateError } = await supabase
      .from('lobby_participants')
      .update({ status: 'left', is_ready: false })
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id);
      
    if (updateError) {
      console.error("[TOURNAMENT] Error marking participant as left:", updateError);
      return false;
    }
    
    console.log(`[TOURNAMENT] Successfully marked user ${user.user.id} as left from lobby ${lobbyId}`);
    
    // Update the lobby player count
    await updateLobbyPlayerCount(lobbyId);
    
    // If this was a ready check and now we don't have 4 players, cancel it
    if (lobby?.status === 'ready_check') {
      const { data: activeParticipants } = await supabase
        .from('lobby_participants')
        .select('id')
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
        
      if (!activeParticipants || activeParticipants.length < 4) {
        console.log(`[TOURNAMENT] Canceling ready check for lobby ${lobbyId} as there are now less than 4 players`);
        await supabase
          .from('tournament_lobbies')
          .update({ 
            status: 'waiting',
            ready_check_started_at: null
          })
          .eq('id', lobbyId);
          
        // Reset ready status for all remaining participants
        await supabase
          .from('lobby_participants')
          .update({ 
            status: 'searching',
            is_ready: false 
          })
          .eq('lobby_id', lobbyId)
          .in('status', ['ready']);
      }
    }
    
    return true;
  } catch (error) {
    console.error("[TOURNAMENT] Error in leaveQuickTournament:", error);
    return false;
  }
};

const updateLobbyPlayerCount = async (lobbyId: string) => {
  try {
    // Get the current active participants count (only searching or ready players)
    const { data: participants, error: countError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error("[TOURNAMENT] Error counting participants:", countError);
      return;
    }
    
    const activeCount = participants?.length || 0;
    console.log(`[TOURNAMENT] Lobby ${lobbyId} has ${activeCount} active participants`);
    
    if (participants) {
      console.log(`[TOURNAMENT] Participants in lobby ${lobbyId}:`, participants.map(p => ({ 
        id: p.user_id, 
        status: p.status, 
        ready: p.is_ready 
      })));
    }
    
    // Update the lobby's current_players count
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: activeCount })
      .eq('id', lobbyId);
      
    if (updateError) {
      console.error("[TOURNAMENT] Error updating lobby player count:", updateError);
    }
    
    // If we have exactly 4 players, update the lobby status to ready_check
    if (activeCount === 4) {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} has 4 players, starting ready check`);
      const { error: statusError } = await supabase
        .from('tournament_lobbies')
        .update({ 
          status: 'ready_check',
          ready_check_started_at: new Date().toISOString()
        })
        .eq('id', lobbyId)
        .eq('status', 'waiting');
        
      if (statusError) {
        console.error("[TOURNAMENT] Error updating lobby status to ready_check:", statusError);
      }
    } else if (activeCount < 4) {
      // If we have less than 4 players and status was ready_check, revert to waiting
      const { data: lobby } = await supabase
        .from('tournament_lobbies')
        .select('status')
        .eq('id', lobbyId)
        .single();
        
      if (lobby && lobby.status === 'ready_check') {
        console.log(`[TOURNAMENT] Lobby ${lobbyId} no longer has 4 players, reverting to waiting status`);
        await supabase
          .from('tournament_lobbies')
          .update({ 
            status: 'waiting', 
            ready_check_started_at: null 
          })
          .eq('id', lobbyId);
          
        // Also reset any ready players
        await supabase
          .from('lobby_participants')
          .update({ 
            status: 'searching', 
            is_ready: false 
          })
          .eq('lobby_id', lobbyId)
          .eq('status', 'ready');
      }
    }
  } catch (error) {
    console.error("[TOURNAMENT] Error in updateLobbyPlayerCount:", error);
  }
};

export const markUserAsReady = async (lobbyId: string) => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user?.user) {
    throw new Error("Необходимо авторизоваться для участия в турнирах");
  }
  
  console.log(`[TOURNAMENT] User ${user.user.id} marking as ready in lobby ${lobbyId}`);
  
  try {
    // First verify this lobby is in ready_check state with 4 players
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players')
      .eq('id', lobbyId)
      .single();
      
    if (lobbyError) {
      console.error("[TOURNAMENT] Error checking lobby status:", lobbyError);
      throw new Error("Не удалось проверить статус лобби");
    }
    
    if (lobby.status !== 'ready_check') {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} not in ready_check state (${lobby.status})`);
      throw new Error("Лобби не в состоянии проверки готовности");
    }
    
    if (lobby.current_players !== 4) {
      console.log(`[TOURNAMENT] Lobby ${lobbyId} does not have 4 players (${lobby.current_players})`);
      throw new Error("Недостаточно игроков для начала турнира");
    }
    
    // Mark current user as ready
    const { error } = await supabase
      .from('lobby_participants')
      .update({
        is_ready: true,
        status: 'ready'
      })
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id);
    
    if (error) {
      console.error("[TOURNAMENT] Error marking user as ready:", error);
      throw new Error("Не удалось подтвердить готовность. Пожалуйста, попробуйте снова.");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} successfully marked as ready`);
    
    // Check if all players are ready and create tournament if needed
    const isAllReady = await checkAllPlayersReady(lobbyId);
    
    return { 
      ready: true, 
      allReady: isAllReady.allReady,
      tournamentId: isAllReady.tournamentId 
    };
  } catch (error) {
    console.error("[TOURNAMENT] Error in markUserAsReady:", error);
    throw error;
  }
};

export const checkAllPlayersReady = async (lobbyId: string) => {
  try {
    console.log(`[TOURNAMENT] Checking all players ready for lobby ${lobbyId}`);
    
    // Get lobby info first
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('id, current_players, max_players, status, tournament_id')
      .eq('id', lobbyId)
      .single();
    
    if (lobbyError) {
      console.error("[TOURNAMENT] Error getting lobby info:", lobbyError);
      return { allReady: false, tournamentId: null };
    }
    
    console.log(`[TOURNAMENT] Lobby ${lobbyId} status: ${lobby.status}, players: ${lobby.current_players}/${lobby.max_players}, tournament: ${lobby.tournament_id || 'none'}`);
    
    // If tournament is already created, return its ID
    if (lobby.tournament_id) {
      console.log(`[TOURNAMENT] Tournament already exists for lobby ${lobbyId}, ID: ${lobby.tournament_id}`);
      return { allReady: true, tournamentId: lobby.tournament_id };
    }
    
    // Get all participants in the lobby
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
    
    if (participantsError) {
      console.error("[TOURNAMENT] Error checking player readiness:", participantsError);
      return { allReady: false, tournamentId: null };
    }
    
    if (!participants || participants.length === 0) {
      console.log(`[TOURNAMENT] No active participants found for lobby ${lobbyId}`);
      return { allReady: false, tournamentId: null };
    }
    
    // Log detailed information about participants
    participants.forEach(p => {
      console.log(`[TOURNAMENT] Participant in ${lobbyId}: userId=${p.user_id}, isReady=${p.is_ready}, status=${p.status}`);
    });
    
    // Count only truly ready players (both is_ready flag and status = 'ready')
    const readyParticipants = participants.filter(p => p.is_ready && p.status === 'ready') || [];
    const activeParticipants = participants.length || 0;
    
    console.log(`[TOURNAMENT] Lobby ${lobbyId} has ${readyParticipants.length} ready participants out of ${activeParticipants} active participants`);
    
    // Check if we have exactly the right number of players and they're all ready
    if (readyParticipants.length === lobby.max_players && activeParticipants === lobby.max_players) {
      console.log(`[TOURNAMENT] All ${lobby.max_players} players are ready in lobby ${lobbyId}. Creating tournament...`);
      
      // We need to set the lobby to 'waiting' status which is valid for tournament creation
      // The database function requires 'waiting' status to create tournaments
      const { error: statusUpdateError } = await supabase
        .from('tournament_lobbies')
        .update({ status: 'waiting' })
        .eq('id', lobbyId);
      
      if (statusUpdateError) {
        console.error("[TOURNAMENT] Error updating lobby status before tournament creation:", statusUpdateError);
        return { allReady: true, tournamentId: null };
      }
      
      // Add a delay to ensure the status update is processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // Call the RPC function to create a tournament
        console.log(`[TOURNAMENT] Calling create_matches_for_quick_tournament for lobby ${lobbyId}`);
        const { error } = await supabase.rpc('create_matches_for_quick_tournament', {
          lobby_id: lobbyId
        });
        
        if (error) {
          console.error("[TOURNAMENT] Error creating tournament:", error);
          return { allReady: true, tournamentId: null };
        }
        
        // Add a delay to ensure tournament is created
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the tournament ID that was created
        const { data: updatedLobby, error: updateError } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .single();
        
        if (updateError || !updatedLobby?.tournament_id) {
          console.error("[TOURNAMENT] Error getting tournament ID or tournament not created");
          return { allReady: true, tournamentId: null };
        }
        
        console.log(`[TOURNAMENT] Tournament created successfully! ID: ${updatedLobby.tournament_id}`);
        return { allReady: true, tournamentId: updatedLobby.tournament_id };
      } catch (error) {
        console.error("[TOURNAMENT] Error in tournament creation process:", error);
        return { allReady: true, tournamentId: null };
      }
    }
    
    console.log(`[TOURNAMENT] Not all players are ready yet in lobby ${lobbyId}`);
    return { allReady: false, tournamentId: null };
  } catch (error) {
    console.error("[TOURNAMENT] Error in checkAllPlayersReady:", error);
    return { allReady: false, tournamentId: null };
  }
};

export const getLobbyStatus = async (lobbyId: string) => {
  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('*, lobby_participants(*)')
    .eq('id', lobbyId)
    .single();
  
  if (error) {
    console.error("[TOURNAMENT] Error getting lobby status:", error);
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
    throw new Error("Вы не вляетесь участником этого матча");
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
      throw new Error("Не удалось отклонить реультаты. Пожалуйста, попробуйте снова.");
    }
  }
  
  return true;
};

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
