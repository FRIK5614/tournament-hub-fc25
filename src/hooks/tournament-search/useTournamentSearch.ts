
import { useReducer, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initialState, tournamentSearchReducer } from './reducer';
import { UseTournamentSearchResult } from './types';
import { useTournamentCreation } from './useTournamentCreation';
import { useSearchSubscriptions } from './useSearchSubscriptions';
import { usePollingRefresh } from './usePollingRefresh';
import { useReadyCheck } from './useReadyCheck';
import { useSearchActions } from './useSearchActions';
import { supabase } from "@/integrations/supabase/client";

export const useTournamentSearch = (): UseTournamentSearchResult => {
  const [state, dispatch] = useReducer(tournamentSearchReducer, initialState);
  const navigate = useNavigate();
  const cleanupSubscriptionRef = useRef<(() => void) | null>(null);

  // Effect to get current user ID on mount
  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          dispatch({ type: 'SET_CURRENT_USER_ID', payload: userData.user.id });
          console.log(`[TOURNAMENT-UI] Current user ID set: ${userData.user.id}`);
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error getting current user ID:", error);
      }
    };
    
    getCurrentUserId();
  }, []);

  // Set up cleanup function reference
  const setupCleanupFunction = (cleanup: () => void) => {
    // Clean up any existing function
    if (cleanupSubscriptionRef.current) {
      cleanupSubscriptionRef.current();
    }
    cleanupSubscriptionRef.current = cleanup;
  };

  // Use the polling refresh hook with ready check state
  const { refreshLobbyData } = usePollingRefresh(
    state.isSearching,
    state.lobbyId,
    state.readyCheckActive,
    dispatch
  );

  // Use the search actions hook
  const { 
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady
  } = useSearchActions(
    state,
    dispatch,
    setupCleanupFunction,
    refreshLobbyData
  );

  // Use the extracted tournament creation logic
  const { checkTournamentCreation } = useTournamentCreation(
    state, 
    dispatch, 
    handleCancelSearch
  );

  // Use the ready check hook
  useReadyCheck(
    state,
    dispatch,
    handleCancelSearch,
    checkTournamentCreation
  );

  // Use the subscriptions hook
  useSearchSubscriptions(
    state.isSearching,
    state.lobbyId,
    refreshLobbyData
  );

  // Effect to ensure lobby participant statuses are synced
  useEffect(() => {
    if (state.isSearching && state.lobbyId && state.readyCheckActive) {
      const syncLobbyParticipantStatuses = async () => {
        try {
          // Ensure all participants have 'ready' status when in ready check mode
          const { error } = await supabase
            .from('lobby_participants')
            .update({ status: 'ready' })
            .eq('lobby_id', state.lobbyId)
            .in('status', ['searching']);
            
          if (error) {
            console.error("[TOURNAMENT-UI] Error updating participant statuses:", error);
          } else {
            console.log("[TOURNAMENT-UI] Updated participants to 'ready' status in ready check mode");
          }
        } catch (err) {
          console.error("[TOURNAMENT-UI] Error in syncLobbyParticipantStatuses:", err);
        }
      };
      
      // Run immediately and then every 3 seconds
      syncLobbyParticipantStatuses();
      const intervalId = setInterval(syncLobbyParticipantStatuses, 3000);
      
      return () => clearInterval(intervalId);
    }
  }, [state.isSearching, state.lobbyId, state.readyCheckActive]);

  // Debug logging for state changes
  useEffect(() => {
    console.log("[TOURNAMENT-UI] State updated:", {
      readyPlayers: state.readyPlayers,
      participants: state.lobbyParticipants.map(p => ({ id: p.user_id, ready: p.is_ready, status: p.status })),
      readyCheckActive: state.readyCheckActive
    });
  }, [state.readyPlayers, state.lobbyParticipants, state.readyCheckActive]);

  // Effect to handle cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (cleanupSubscriptionRef.current) {
        console.log("[TOURNAMENT-UI] Component unmounting, cleaning up subscriptions");
        cleanupSubscriptionRef.current();
        cleanupSubscriptionRef.current = null;
      }
    };
  }, []);

  return {
    isSearching: state.isSearching,
    lobbyId: state.lobbyId,
    readyCheckActive: state.readyCheckActive,
    countdownSeconds: state.countdownSeconds,
    lobbyParticipants: state.lobbyParticipants,
    readyPlayers: state.readyPlayers,
    currentUserId: state.currentUserId,
    isLoading: state.isLoading,
    isCreatingTournament: state.isCreatingTournament,
    tournamentCreationStatus: state.tournamentCreationStatus,
    tournamentId: state.tournamentId,
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady,
  };
};
