
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureParticipantStatus, parseLobbyParticipants, enrichParticipantsWithProfiles } from './utils';
import { TournamentSearchAction } from './reducer';

export function usePollingRefresh(
  isSearching: boolean,
  lobbyId: string | null,
  readyCheckActive: boolean,
  dispatch: React.Dispatch<TournamentSearchAction>
) {
  const refreshLobbyData = useCallback(async (lobbyId: string) => {
    if (!lobbyId) return;
    
    try {
      console.log(`[TOURNAMENT-UI] Refreshing lobby data for ${lobbyId}`);
      
      // Get the lobby state first
      const { data: lobby, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('id, status, current_players, tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (lobbyError) {
        console.error("[TOURNAMENT-UI] Error fetching lobby:", lobbyError);
        return;
      }
      
      // If tournament exists, update state
      if (lobby?.tournament_id) {
        console.log(`[TOURNAMENT-UI] Found tournament ID during refresh: ${lobby.tournament_id}`);
        dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
      }
      
      // If lobby status is ready_check but our state doesn't reflect that, update it
      if (lobby?.status === 'ready_check' && !readyCheckActive) {
        console.log('[TOURNAMENT-UI] Updating state to ready_check from polling');
        dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
        dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });
      }
      
      // Get all participants with their profiles
      const { data: participants, error: participantsError } = await supabase
        .from('lobby_participants')
        .select(`
          id,
          user_id,
          lobby_id,
          status,
          is_ready,
          profile:profiles(id, username, avatar_url)
        `)
        .eq('lobby_id', lobbyId)
        .in('status', ['searching', 'ready']);
        
      if (participantsError) {
        console.error("[TOURNAMENT-UI] Error fetching participants:", participantsError);
        return;
      }
      
      if (!participants || participants.length === 0) {
        console.log("[TOURNAMENT-UI] No participants found during refresh");
        return;
      }
      
      // Enhance participants with missing profile data if needed
      const enhancedParticipants = await enrichParticipantsWithProfiles(participants);
      
      // Parse the participants into the expected format
      const parsedParticipants = parseLobbyParticipants(enhancedParticipants);
      
      // During ready check, ensure all participants have status 'ready'
      if (readyCheckActive || lobby?.status === 'ready_check') {
        await ensureParticipantStatus(parsedParticipants, lobbyId);
        
        // Re-fetch after ensuring status
        const { data: updatedParticipants } = await supabase
          .from('lobby_participants')
          .select(`
            id,
            user_id,
            lobby_id,
            status,
            is_ready,
            profile:profiles(id, username, avatar_url)
          `)
          .eq('lobby_id', lobbyId)
          .in('status', ['searching', 'ready']);
          
        if (updatedParticipants && updatedParticipants.length > 0) {
          const enhancedUpdatedParticipants = await enrichParticipantsWithProfiles(updatedParticipants);
          dispatch({ 
            type: 'SET_LOBBY_PARTICIPANTS',
            payload: parseLobbyParticipants(enhancedUpdatedParticipants)
          });
        }
      } else {
        // Update participant state
        dispatch({ 
          type: 'SET_LOBBY_PARTICIPANTS',
          payload: parsedParticipants
        });
      }
      
      // Update ready players list
      const readyPlayers = parsedParticipants
        .filter(p => p.is_ready)
        .map(p => p.user_id);
        
      dispatch({ type: 'SET_READY_PLAYERS', payload: readyPlayers });
      
      console.log(`[TOURNAMENT-UI] Refreshed ${parsedParticipants.length} participants (${readyPlayers.length} ready)`);
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error refreshing lobby data:", error);
    }
  }, [readyCheckActive, dispatch]);
  
  return { refreshLobbyData };
}
