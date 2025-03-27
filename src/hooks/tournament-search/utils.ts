
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
      
      // If lobby is in ready_check, double-check participants status
      if (lobbyData.status === 'ready_check') {
        console.log("[TOURNAMENT-UI] Lobby in ready_check state, ensuring participants have correct status");
        try {
          // Ensure all participants have status 'ready' when in ready check mode
          await supabase
            .from('lobby_participants')
            .update({ status: 'ready' })
            .eq('lobby_id', lobbyId)
            .in('status', ['searching']);
        } catch (err) {
          console.error("[TOURNAMENT-UI] Error updating participant statuses in ready check:", err);
        }
      }
      
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
      
      // Log details for debugging
      actualParticipants.forEach(p => {
        console.log(`[TOURNAMENT-UI] Participant in lobby ${lobbyId}: user_id=${p.user_id}, is_ready=${p.is_ready}, status=${p.status}`);
      });
      
      // Log ready players for debugging
      const readyPlayers = actualParticipants.filter(p => p.is_ready).map(p => p.user_id);
      console.log(`[TOURNAMENT-UI] Ready players in lobby ${lobbyId}:`, readyPlayers);
      
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

// Add a new function to fetch ready players directly
export const fetchReadyPlayers = async (lobbyId: string): Promise<string[]> => {
  try {
    console.log(`[TOURNAMENT-UI] Fetching ready players for lobby ${lobbyId}`);
    
    const { data, error } = await supabase
      .from('lobby_participants')
      .select('user_id')
      .eq('lobby_id', lobbyId)
      .eq('is_ready', true)
      .in('status', ['searching', 'ready']);
    
    if (error) {
      console.error("[TOURNAMENT-UI] Error fetching ready players:", error);
      return [];
    }
    
    const readyPlayers = data?.map(p => p.user_id) || [];
    console.log(`[TOURNAMENT-UI] Found ${readyPlayers.length} ready players in lobby ${lobbyId}:`, readyPlayers);
    
    return readyPlayers;
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchReadyPlayers:", error);
    return [];
  }
};

// Function to ensure all participants have correct status in ready check
export const ensureParticipantStatus = async (lobbyId: string): Promise<void> => {
  try {
    console.log(`[TOURNAMENT-UI] Ensuring participant statuses for lobby ${lobbyId}`);
    
    // First check lobby status
    const { data: lobby } = await supabase
      .from('tournament_lobbies')
      .select('status')
      .eq('id', lobbyId)
      .maybeSingle();
      
    if (lobby?.status === 'ready_check') {
      // Update all participants to 'ready' status when in ready check
      const { error } = await supabase
        .from('lobby_participants')
        .update({ status: 'ready' })
        .eq('lobby_id', lobbyId)
        .in('status', ['searching']);
        
      if (error) {
        console.error("[TOURNAMENT-UI] Error updating participant statuses:", error);
      } else {
        console.log("[TOURNAMENT-UI] Successfully updated participant statuses to 'ready'");
      }
    }
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in ensureParticipantStatus:", error);
  }
};
