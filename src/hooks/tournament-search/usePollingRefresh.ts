
import { useEffect, useCallback, useRef } from 'react';
import { fetchLobbyStatus, fetchLobbyParticipants } from './utils';
import { TournamentSearchAction } from './reducer';
import { supabase, resetSupabaseConnection } from '@/integrations/supabase/client';

// Determine if we're in a production environment
const isProduction = window.location.hostname !== 'localhost' && 
                    !window.location.hostname.includes('preview--') && 
                    !window.location.hostname.includes('127.0.0.1');

// Use a shorter polling interval in production to compensate for any subscription issues
const POLLING_INTERVAL = isProduction ? 2000 : 3000;

export const usePollingRefresh = (
  isSearching: boolean,
  lobbyId: string | null,
  dispatch: React.Dispatch<TournamentSearchAction>
) => {
  const retryCountRef = useRef(0);
  const lastSuccessfulFetchRef = useRef<number>(Date.now());
  
  // Function to refresh lobby data with enhanced error handling
  const refreshLobbyData = useCallback(async (lobbyId: string) => {
    if (!lobbyId) return;
    
    try {
      console.log(`[TOURNAMENT-UI] Refreshing data for lobby ${lobbyId}`);
      
      // Fetch lobby status
      const status = await fetchLobbyStatus(lobbyId);
      console.log(`[TOURNAMENT-UI] Lobby status: ${status.status}, players: ${status.current_players}/${status.max_players}`);
      dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: status.status === 'ready_check' });
      
      // Fetch participants
      try {
        const participants = await fetchLobbyParticipants(lobbyId);
        console.log(`[TOURNAMENT-UI] Refreshed participants: ${participants.length}`);
        dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: participants });
        
        // Reset retry counter after successful fetch
        retryCountRef.current = 0;
        lastSuccessfulFetchRef.current = Date.now();
      } catch (err) {
        console.error("[TOURNAMENT-UI] Error refreshing participants:", err);
        handleRefreshError(err);
      }
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error refreshing lobby data:", error);
      handleRefreshError(error);
    }
  }, [dispatch]);

  // Helper function to handle refresh errors with progressive recovery
  const handleRefreshError = useCallback((error: any) => {
    retryCountRef.current += 1;
    console.warn(`[TOURNAMENT-UI] Refresh retry count: ${retryCountRef.current}`);
    
    // If we've had multiple failures in a row, try more aggressive recovery
    if (retryCountRef.current >= 3) {
      console.warn("[TOURNAMENT-UI] Multiple refresh failures, attempting connection reset");
      resetSupabaseConnection();
      
      // If it's been more than 10 seconds since successful fetch, show an error
      const timeSinceLastSuccess = Date.now() - lastSuccessfulFetchRef.current;
      if (timeSinceLastSuccess > 10000) {
        console.error("[TOURNAMENT-UI] Connection issues detected, notifying user");
        dispatch({ 
          type: 'SET_TOURNAMENT_CREATION_STATUS', 
          payload: 'error' 
        });
      }
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
      }, POLLING_INTERVAL);
      
      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [isSearching, lobbyId, refreshLobbyData]);

  return { refreshLobbyData };
};
