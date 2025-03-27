
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from './types';

export const fetchLobbyStatus = async (lobbyId: string) => {
  console.log(`[TOURNAMENT-UI] Fetching status for lobby ${lobbyId}`);
  
  const fetchWithRetry = async (retries = 2) => {
    try {
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('status, current_players, max_players, tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
      
      if (lobbyError) {
        throw lobbyError;
      }
      
      if (!lobbyData) {
        console.warn("[TOURNAMENT-UI] No lobby data returned");
        return { status: 'waiting', current_players: 0, max_players: 4, tournament_id: null };
      }
      
      console.log(`[TOURNAMENT-UI] Lobby data: status=${lobbyData.status}, players=${lobbyData.current_players}/${lobbyData.max_players}, tournament=${lobbyData.tournament_id || 'none'}`);
      return lobbyData;
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error in fetchLobbyStatus:", error);
      if (retries > 0) {
        console.log(`[TOURNAMENT-UI] Retrying fetchLobbyStatus, ${retries} retries left`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchWithRetry(retries - 1);
      }
      // Return default values to prevent app from crashing
      return { status: 'waiting', current_players: 0, max_players: 4, tournament_id: null };
    }
  };
  
  return fetchWithRetry();
};

export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  const fetchWithRetry = async (retries = 2): Promise<LobbyParticipant[]> => {
    try {
      console.log(`[TOURNAMENT-UI] Fetching participants for lobby ${lobbyId}`);
      
      const { data: participants, error: participantsError } = await supabase
        .from('lobby_participants')
        .select('id, user_id, lobby_id, is_ready, status')
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
      
      if (participantsError) {
        throw participantsError;
      }
      
      const actualParticipants = participants || [];
      console.log(`[TOURNAMENT-UI] Found ${actualParticipants.length} active participants in lobby ${lobbyId}`);
      
      if (actualParticipants.length > 0) {
        // Get user IDs array
        const userIds = actualParticipants.map(p => p.user_id);
        
        try {
          // Fetch profiles in a separate try/catch to handle potential errors
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
            
          if (profilesError) {
            throw profilesError;
          }
          
          // Map participants with their profiles
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
        } catch (err) {
          console.error("[TOURNAMENT-UI] Error processing profiles:", err);
          // Return participants without profiles if profiles fetch fails
          return actualParticipants.map(p => ({
            ...p,
            profile: { username: 'Игрок', avatar_url: null }
          }));
        }
      }
      
      return [];
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
      if (retries > 0) {
        console.log(`[TOURNAMENT-UI] Retrying fetchLobbyParticipants, ${retries} retries left`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchWithRetry(retries - 1);
      }
      return [];
    }
  };
  
  return fetchWithRetry();
};
