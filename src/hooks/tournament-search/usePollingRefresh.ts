
import { useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { updateLobbyPlayerCount } from './utils';
import { TournamentSearchAction } from './reducer';

export const usePollingRefresh = (
  isSearching: boolean,
  lobbyId: string | null,
  readyCheckActive: boolean,
  dispatch: React.Dispatch<TournamentSearchAction>
) => {
  const refreshLobbyData = useCallback(async (lobbyId: string) => {
    try {
      console.log(`[TOURNAMENT-UI] Refreshing lobby data for ${lobbyId}`);
      
      // Get lobby status
      const { data: lobby, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('id, status, current_players, tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (lobbyError) {
        console.error('[TOURNAMENT-UI] Error fetching lobby:', lobbyError);
        return;
      }
      
      if (lobby) {
        if (lobby.tournament_id && lobby.tournament_id !== null) {
          console.log(`[TOURNAMENT-UI] Found tournament during refresh: ${lobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
        }
        
        // Update ready check state based on lobby status
        dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: lobby.status === 'ready_check' });
      }
      
      // Get participants - don't try to join with profiles which causes errors
      try {
        // Simple select without JOIN to profiles
        const { data: participants, error: participantsError } = await supabase
          .from('lobby_participants')
          .select('id, user_id, status, is_ready')
          .eq('lobby_id', lobbyId)
          .in('status', ['searching', 'ready']);
          
        if (participantsError) {
          throw participantsError;
        }
        
        console.log(`[TOURNAMENT-UI] Updating lobby ${lobbyId} player count to ${participants?.length || 0}`);
        console.log(`[TOURNAMENT-UI] Participants found:`, participants);

        // Format participants with empty profile data
        const formattedParticipants = participants?.map(p => ({
          ...p,
          lobby_id: lobbyId,
          profile: {
            username: `Player-${p.user_id.substring(0, 6)}`,
            avatar_url: null
          }
        })) || [];
        
        dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: formattedParticipants });
        dispatch({ type: 'SET_READY_PLAYERS', payload: formattedParticipants.filter(p => p.is_ready).map(p => p.user_id) });
        
        // Update the ready check if we have exactly 4 participants
        if (formattedParticipants.length === 4 && !readyCheckActive && lobby?.status === 'waiting') {
          console.log('[TOURNAMENT-UI] Full lobby detected, triggering ready check');
          
          // Try to update it to ready_check
          await supabase
            .from('tournament_lobbies')
            .update({ 
              status: 'ready_check', 
              ready_check_started_at: new Date().toISOString() 
            })
            .eq('id', lobbyId)
            .eq('status', 'waiting');
            
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
          dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });
        }
        
        console.log(`[TOURNAMENT-UI] After update: ${formattedParticipants.length} participants`);
        
        // For debug, fetch current lobby state to check if it matches our UI state
        const { data: currentLobby } = await supabase
          .from('tournament_lobbies')
          .select('current_players, status')
          .eq('id', lobbyId)
          .maybeSingle();
          
        console.log(`[TOURNAMENT-UI] Current lobby state:`, currentLobby);
        
        // Update the lobby player count to ensure accuracy
        await updateLobbyPlayerCount(lobbyId);
      } catch (error) {
        console.error('[TOURNAMENT-UI] Error fetching participants:', error);
      }
    } catch (error) {
      console.error('[TOURNAMENT-UI] Error refreshing lobby data:', error);
    }
  }, [dispatch, readyCheckActive]);

  // Set up polling for lobby data
  useEffect(() => {
    if (isSearching && lobbyId) {
      console.log('[TOURNAMENT-UI] Polling for lobby data updates');
      
      refreshLobbyData(lobbyId);
      
      const intervalId = setInterval(() => {
        refreshLobbyData(lobbyId);
      }, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [isSearching, lobbyId, refreshLobbyData]);

  return { refreshLobbyData };
};
