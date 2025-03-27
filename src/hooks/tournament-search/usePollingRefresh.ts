
import { useEffect, useCallback } from 'react';
import { fetchLobbyStatus, fetchLobbyParticipants } from './utils';
import { TournamentSearchAction } from './reducer';

export const usePollingRefresh = (
  isSearching: boolean,
  lobbyId: string | null,
  dispatch: React.Dispatch<TournamentSearchAction>
) => {
  // Function to refresh lobby data
  const refreshLobbyData = useCallback(async (lobbyId: string) => {
    if (!lobbyId) return;
    
    try {
      console.log(`[TOURNAMENT-UI] Refreshing data for lobby ${lobbyId}`);
      const status = await fetchLobbyStatus(lobbyId);
      dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: status.status === 'ready_check' });
      
      const participants = await fetchLobbyParticipants(lobbyId);
      console.log(`[TOURNAMENT-UI] Refreshed participants: ${participants.length}`);
      dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: participants });
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error refreshing lobby data:", error);
    }
  }, [dispatch]);

  // Periodically refresh lobby data even if subscriptions fail
  useEffect(() => {
    if (isSearching && lobbyId) {
      const refreshInterval = setInterval(() => {
        refreshLobbyData(lobbyId);
      }, 5000); // Every 5 seconds
      
      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [isSearching, lobbyId, refreshLobbyData]);

  return { refreshLobbyData };
};
