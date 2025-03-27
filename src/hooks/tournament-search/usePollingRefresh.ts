
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
      console.log(`[TOURNAMENT-UI] Lobby status: ${status.status}, players: ${status.current_players}/${status.max_players}`);
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
      // Initial fetch immediately
      refreshLobbyData(lobbyId).catch(err => 
        console.error("[TOURNAMENT-UI] Initial polling refresh error:", err)
      );
      
      // Then set up interval for subsequent refreshes
      const refreshInterval = setInterval(() => {
        refreshLobbyData(lobbyId).catch(err => 
          console.error("[TOURNAMENT-UI] Interval polling refresh error:", err)
        );
      }, 3000); // Every 3 seconds instead of 5 for more responsiveness
      
      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [isSearching, lobbyId, refreshLobbyData]);

  return { refreshLobbyData };
};
