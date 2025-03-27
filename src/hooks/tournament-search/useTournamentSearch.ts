
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchLobbyStatus, fetchLobbyParticipants } from './utils';
import { TournamentSearchState } from './types';
import { TournamentSearchAction, initialState, tournamentSearchReducer } from './reducer';
import { useSearchActions } from './useSearchActions';
import { useReadyCheck } from './useReadyCheck';
import { useTournamentCreation } from './useTournamentCreation';
import { useSearchSubscriptions } from './useSearchSubscriptions';

export const useTournamentSearch = () => {
  const [state, dispatch] = useState<TournamentSearchState>(initialState);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cleanupFunction, setCleanupFunction] = useState<(() => void) | null>(null);
  const cleanupFunctionRef = useRef(cleanupFunction);

  // Update the ref whenever cleanupFunction changes
  useEffect(() => {
    cleanupFunctionRef.current = cleanupFunction;
  }, [cleanupFunction]);

  // This function will be called when the component unmounts
  useEffect(() => {
    return () => {
      if (cleanupFunctionRef.current) {
        cleanupFunctionRef.current();
      }
    };
  }, []);

  const setupCleanupFunction = (cleanup: () => void) => {
    setCleanupFunction(() => cleanup);
  };

  const refreshLobbyData = useCallback(async (lobbyId: string) => {
    try {
      console.log("[TOURNAMENT-UI] Refreshing lobby data for", lobbyId);
      
      // Fetch lobby status
      const lobbyStatus = await fetchLobbyStatus(lobbyId);
      console.log("[TOURNAMENT-UI] Lobby status:", lobbyStatus);
      
      dispatch({ 
        type: 'SET_READY_CHECK_ACTIVE', 
        payload: lobbyStatus.status === 'ready_check' 
      });
      
      if (lobbyStatus.status === 'ready_check') {
        dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 120 });
      }

      // Fetch participants
      const participants = await fetchLobbyParticipants(lobbyId);
      console.log("[TOURNAMENT-UI] Fetched participants:", participants);
      
      dispatch({ 
        type: 'SET_LOBBY_PARTICIPANTS', 
        payload: participants 
      });
      
      // If lobby has tournament_id, set it
      if (lobbyStatus.tournament_id) {
        console.log(`[TOURNAMENT-UI] Lobby has tournament: ${lobbyStatus.tournament_id}`);
        dispatch({ 
          type: 'SET_TOURNAMENT_ID', 
          payload: lobbyStatus.tournament_id 
        });
      }
    } catch (error) {
      console.error("Error refreshing lobby data:", error);
      toast({
        title: "Ошибка обновления",
        description: "Не удалось получить актуальные данные лобби. Пожалуйста, попробуйте отменить и начать поиск заново.",
        variant: "destructive",
      });
    }
  }, [toast]);
  
  const { 
    handleStartSearch, 
    handleCancelSearch, 
    handleReadyCheck,
    isUserReady
  } = useSearchActions(
    state, 
    dispatch as React.Dispatch<TournamentSearchAction>, 
    setupCleanupFunction, 
    refreshLobbyData
  );
  
  // Return a Promise function for checkTournamentTrigger
  const triggerTournamentCheck = useCallback(async (): Promise<void> => {
    dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
    return Promise.resolve();
  }, []);
  
  // Setup realtime subscriptions
  useSearchSubscriptions(
    state.isSearching,
    state.lobbyId,
    refreshLobbyData,
    dispatch as React.Dispatch<TournamentSearchAction>
  );
  
  useReadyCheck(
    state, 
    dispatch as React.Dispatch<TournamentSearchAction>, 
    handleCancelSearch, 
    triggerTournamentCheck
  );
  
  const { checkTournamentCreation } = useTournamentCreation(
    state, 
    dispatch as React.Dispatch<TournamentSearchAction>, 
    handleCancelSearch
  );

  return {
    isSearching: state.isSearching,
    readyCheckActive: state.readyCheckActive,
    countdownSeconds: state.countdownSeconds,
    lobbyParticipants: state.lobbyParticipants || [],
    readyPlayers: state.readyPlayers || [],
    isLoading: state.isLoading,
    tournamentCreationStatus: state.tournamentCreationStatus || '',
    isCreatingTournament: state.isCreatingTournament,
    tournamentId: state.tournamentId,
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady,
    checkTournamentCreation
  };
};
