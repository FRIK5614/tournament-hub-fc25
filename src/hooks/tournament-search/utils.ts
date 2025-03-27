
import { supabase } from "@/integrations/supabase/client";

export const updateLobbyPlayerCount = async (lobbyId: string): Promise<number> => {
  try {
    console.log(`[TOURNAMENT-UI] Updating lobby ${lobbyId} player count`);
    
    const { data: participants, error: countError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error('[TOURNAMENT-UI] Error counting lobby participants:', countError);
      return 0;
    }
    
    const count = participants?.length || 0;
    console.log(`[TOURNAMENT-UI] Count: ${count} players active in lobby ${lobbyId}`);
    
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
    if (updateError) {
      console.error('[TOURNAMENT-UI] Error updating lobby count:', updateError);
    }
    
    return count;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error updating lobby player count:', error);
    return 0;
  }
};

export const cleanupStaleLobbies = async () => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    
    await supabase
      .from('lobby_participants')
      .update({ status: 'left' })
      .eq('user_id', user.user.id)
      .in('status', ['searching', 'ready']);
      
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error cleaning up stale lobbies:', error);
  }
};

export const fetchLobbyStatus = async (lobbyId: string) => {
  console.log(`[TOURNAMENT-UI] Fetching status for lobby ${lobbyId}`);
  
  try {
    const { data, error } = await supabase
      .from('tournament_lobbies')
      .select('status, current_players, tournament_id, ready_check_started_at')
      .eq('id', lobbyId)
      .single();
      
    if (error) {
      console.error('[TOURNAMENT-UI] Error fetching lobby status:', error);
      throw error;
    }
    
    console.log(`[TOURNAMENT-UI] Lobby ${lobbyId} status: ${data.status}, players: ${data.current_players}`);
    return data;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in fetchLobbyStatus:', error);
    throw error;
  }
};

export const fetchLobbyParticipants = async (lobbyId: string) => {
  console.log(`[TOURNAMENT-UI] Fetching participants for lobby ${lobbyId}`);
  
  try {
    // First get participants
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, lobby_id, status, is_ready')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (participantsError) {
      console.error('[TOURNAMENT-UI] Error fetching lobby participants:', participantsError);
      throw participantsError;
    }
    
    if (!participants || participants.length === 0) {
      console.log(`[TOURNAMENT-UI] No active participants found in lobby ${lobbyId}`);
      return [];
    }
    
    // Get all profiles for these participants in one batch query
    const userIds = participants.map(p => p.user_id);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
      
    if (profilesError) {
      console.error('[TOURNAMENT-UI] Error fetching participant profiles:', profilesError);
    }
    
    // Add profile data to participants
    const participantsWithProfiles = participants.map(participant => {
      const profile = profiles?.find(p => p.id === participant.user_id);
      return {
        ...participant,
        profile: profile || { 
          username: `Player-${participant.user_id.substring(0, 6)}`,
          avatar_url: null
        }
      };
    });
    
    console.log(`[TOURNAMENT-UI] Found ${participantsWithProfiles.length} participants in lobby ${lobbyId}:`, 
      participantsWithProfiles.map(p => p.profile?.username)
    );
    return participantsWithProfiles;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in fetchLobbyParticipants:', error);
    return [];
  }
};
