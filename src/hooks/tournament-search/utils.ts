
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from './types';

export const fetchLobbyStatus = async (lobbyId: string) => {
  console.log(`[TOURNAMENT-UI] Fetching status for lobby ${lobbyId}`);
  
  try {
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
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyStatus:", error);
    // Return default values to prevent app from crashing
    return { status: 'waiting', current_players: 0, max_players: 4, tournament_id: null };
  }
};

export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    console.log(`[TOURNAMENT-UI] Fetching participants for lobby ${lobbyId}`);
    
    const { data: participants, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, lobby_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
    
    if (participantsError) {
      console.error("[TOURNAMENT-UI] Error fetching lobby participants:", participantsError);
      return [];
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
        return actualParticipants.map(p => ({
          ...p,
          profile: { username: 'Игрок', avatar_url: null }
        }));
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
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
    return [];
  }
};

// Setup subscription to lobby updates and return a cleanup function
export const setupLobbySubscriptions = (
  lobbyId: string, 
  callback: () => void
): (() => void) => {
  console.log(`[TOURNAMENT-UI] Setting up subscriptions for lobby ${lobbyId}`);
  
  try {
    const lobbyChannel = supabase
      .channel(`lobby_changes_${lobbyId}`)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'lobby_participants',
        filter: `lobby_id=eq.${lobbyId}`
      }, () => {
        console.log("[TOURNAMENT-UI] Lobby participants changed, refreshing data");
        callback();
      })
      .subscribe((status) => {
        console.log(`[TOURNAMENT-UI] Lobby channel subscription status: ${status}`);
      });
      
    const lobbyStatusChannel = supabase
      .channel(`lobby_status_changes_${lobbyId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_lobbies',
        filter: `id=eq.${lobbyId}`
      }, (payload: any) => {
        console.log("[TOURNAMENT-UI] Lobby status changed:", payload);
        callback();
      })
      .subscribe((status) => {
        console.log(`[TOURNAMENT-UI] Lobby status channel subscription status: ${status}`);
      });
      
    return () => {
      console.log(`[TOURNAMENT-UI] Cleaning up subscriptions for lobby ${lobbyId}`);
      supabase.removeChannel(lobbyChannel);
      supabase.removeChannel(lobbyStatusChannel);
    };
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error setting up subscriptions:", error);
    return () => {}; // Return empty cleanup function to prevent errors
  }
};
