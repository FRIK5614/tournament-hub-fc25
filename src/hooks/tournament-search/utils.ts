
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from './types';

export const fetchLobbyStatus = async (lobbyId: string) => {
  console.log(`[TOURNAMENT-UI] Fetching status for lobby ${lobbyId}`);
  
  const { data: lobbyData, error: lobbyError } = await supabase
    .from('tournament_lobbies')
    .select('id, current_players, status, max_players, tournament_id')
    .eq('id', lobbyId)
    .single();
  
  if (lobbyError) {
    console.error("[TOURNAMENT-UI] Error fetching lobby:", lobbyError);
    throw lobbyError;
  }
  
  console.log(`[TOURNAMENT-UI] Lobby data: status=${lobbyData.status}, players=${lobbyData.current_players}/${lobbyData.max_players}, tournament=${lobbyData.tournament_id || 'none'}`);
  
  return lobbyData;
};

export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  const { data: participants, error: participantsError } = await supabase
    .from('lobby_participants')
    .select('id, user_id, lobby_id, is_ready, status')
    .eq('lobby_id', lobbyId)
    .in('status', ['searching', 'ready']);
  
  if (participantsError) {
    console.error("[TOURNAMENT-UI] Error fetching lobby participants:", participantsError);
    throw participantsError;
  }
  
  const actualParticipants = participants || [];
  console.log(`[TOURNAMENT-UI] Found ${actualParticipants.length} active participants in lobby ${lobbyId}`);
  
  if (actualParticipants.length > 0) {
    const userIds = actualParticipants.map(p => p.user_id);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
      
    if (profilesError) {
      console.error("[TOURNAMENT-UI] Error fetching profiles:", profilesError);
    }
    
    return actualParticipants.map(participant => {
      const profile = profiles?.find(p => p.id === participant.user_id);
      return {
        ...participant,
        profile: profile ? { 
          username: profile.username || 'Игрок', 
          avatar_url: profile.avatar_url 
        } : { 
          username: 'Игрок', 
          avatar_url: null 
        }
      };
    });
  }
  
  return [];
};

export const setupLobbySubscriptions = (
  lobbyId: string, 
  callback: () => void
) => {
  const lobbyChannel = supabase
    .channel('lobby_changes')
    .on('postgres_changes', {
      event: '*', 
      schema: 'public',
      table: 'lobby_participants',
      filter: `lobby_id=eq.${lobbyId}`
    }, () => {
      console.log("[TOURNAMENT-UI] Lobby participants changed, refreshing data");
      callback();
    })
    .subscribe();
    
  const lobbyStatusChannel = supabase
    .channel('lobby_status_changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tournament_lobbies',
      filter: `id=eq.${lobbyId}`
    }, (payload: any) => {
      console.log("[TOURNAMENT-UI] Lobby status changed:", payload);
      callback();
    })
    .subscribe();
    
  return () => {
    supabase.removeChannel(lobbyChannel);
    supabase.removeChannel(lobbyStatusChannel);
  };
};
