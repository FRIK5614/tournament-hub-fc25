
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
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
  const [state, dispatch] = useReducer(tournamentSearchReducer, initialState);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cleanupFunction, setCleanupFunction] = useState<(() => void) | null>(null);
  const cleanupFunctionRef = useRef(cleanupFunction);

  // Получить и сохранить id текущего пользователя
  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          console.error("[TOURNAMENT-UI] Error getting user:", error);
          return;
        }
        
        dispatch({ type: 'SET_CURRENT_USER_ID', payload: data.user.id });
        console.log("[TOURNAMENT-UI] Current user ID set:", data.user.id);
      } catch (err) {
        console.error("[TOURNAMENT-UI] Error in getCurrentUserId:", err);
      }
    };
    
    getCurrentUserId();
  }, []);

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
      
      // Обновляем список готовых игроков
      const readyPlayers = participants
        .filter(p => p.is_ready)
        .map(p => p.user_id);
      
      dispatch({
        type: 'SET_READY_PLAYERS',
        payload: readyPlayers
      });
      
      console.log("[TOURNAMENT-UI] Ready players:", readyPlayers);
      
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
    dispatch,
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
    dispatch
  );
  
  useReadyCheck(
    state, 
    dispatch, 
    handleCancelSearch, 
    triggerTournamentCheck
  );
  
  const { checkTournamentCreation } = useTournamentCreation(
    state, 
    dispatch, 
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
    currentUserId: state.currentUserId,
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady,
    checkTournamentCreation
  };
};
