
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

  // Use the subscriptions hook - now passing dispatch
  useSearchSubscriptions(
    state.isSearching,
    state.lobbyId,
    refreshLobbyData,
    dispatch
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
            .eq('status', 'searching');
            
          if (error) {
            console.error("[TOURNAMENT-UI] Error updating participant statuses:", error);
          } else {
            console.log("[TOURNAMENT-UI] Updated participants from 'searching' to 'ready' status in ready check mode");
          }
          
          // Fetch updated participants to ensure UI is in sync
          await refreshLobbyData(state.lobbyId);
        } catch (err) {
          console.error("[TOURNAMENT-UI] Error in syncLobbyParticipantStatuses:", err);
        }
      };
      
      // Run immediately and then every 2 seconds (more frequent than before)
      syncLobbyParticipantStatuses();
      const intervalId = setInterval(syncLobbyParticipantStatuses, 2000);
      
      return () => clearInterval(intervalId);
    }
  }, [state.isSearching, state.lobbyId, state.readyCheckActive, refreshLobbyData]);

  // Check lobby status more often to catch 'ready_check' transition
  useEffect(() => {
    if (state.isSearching && state.lobbyId && !state.readyCheckActive) {
      const checkLobbyStatus = async () => {
        try {
          const { data: lobby, error } = await supabase
            .from('tournament_lobbies')
            .select('status, current_players')
            .eq('id', state.lobbyId)
            .single();
            
          if (error) {
            console.error("[TOURNAMENT-UI] Error checking lobby status:", error);
            return;
          }
          
          if (lobby.status === 'ready_check') {
            console.log('[TOURNAMENT-UI] Detected ready_check status during polling');
            dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
            dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });
            
            // Update all searching players to ready status
            const { error: updateError } = await supabase
              .from('lobby_participants')
              .update({ status: 'ready' })
              .eq('lobby_id', state.lobbyId)
              .eq('status', 'searching');
              
            if (updateError) {
              console.error("[TOURNAMENT-UI] Error updating participants to ready status:", updateError);
            }
            
            await refreshLobbyData(state.lobbyId);
          }
          
          if (lobby.current_players === 4 && lobby.status === 'waiting') {
            console.log('[TOURNAMENT-UI] Lobby has 4 players but is still in waiting status, triggering ready check');
            
            // If we have 4 players but status is still 'waiting', try to update it
            const { error: updateError } = await supabase
              .from('tournament_lobbies')
              .update({ 
                status: 'ready_check', 
                ready_check_started_at: new Date().toISOString() 
              })
              .eq('id', state.lobbyId)
              .eq('status', 'waiting')
              .eq('current_players', 4);
              
            if (updateError) {
              console.error("[TOURNAMENT-UI] Error updating lobby to ready_check:", updateError);
            } else {
              console.log('[TOURNAMENT-UI] Successfully updated lobby to ready_check');
              dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
              dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });
              await refreshLobbyData(state.lobbyId);
            }
          }
        } catch (err) {
          console.error("[TOURNAMENT-UI] Error in checkLobbyStatus:", err);
        }
      };
      
      // Check immediately and then every 3 seconds
      checkLobbyStatus();
      const intervalId = setInterval(checkLobbyStatus, 3000);
      
      return () => clearInterval(intervalId);
    }
  }, [state.isSearching, state.lobbyId, state.readyCheckActive, refreshLobbyData, dispatch]);

  // Debug logging for state changes
  useEffect(() => {
    console.log("[TOURNAMENT-UI] State updated:", {
      readyPlayers: state.readyPlayers,
      participants: state.lobbyParticipants.map(p => ({ id: p.user_id, ready: p.is_ready, status: p.status })),
      readyCheckActive: state.readyCheckActive,
      lobbyId: state.lobbyId,
      isSearching: state.isSearching
    });
  }, [state.readyPlayers, state.lobbyParticipants, state.readyCheckActive, state.lobbyId, state.isSearching]);

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
