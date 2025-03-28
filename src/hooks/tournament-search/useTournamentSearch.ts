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

// Ключи для localStorage
const LOBBY_STORAGE_KEY = 'tournament_lobby_id';
const SEARCH_STATE_KEY = 'tournament_search_state';

export const useTournamentSearch = () => {
  const [state, dispatch] = useReducer(tournamentSearchReducer, initialState);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cleanupFunction, setCleanupFunction] = useState<(() => void) | null>(null);
  const cleanupFunctionRef = useRef(cleanupFunction);
  
  // Загрузка состояния из localStorage при инициализации
  useEffect(() => {
    try {
      // Проверяем, есть ли сохраненное состояние лобби
      const savedLobbyId = localStorage.getItem(LOBBY_STORAGE_KEY);
      const savedSearchState = localStorage.getItem(SEARCH_STATE_KEY);
      
      if (savedLobbyId && savedSearchState) {
        const parsedState = JSON.parse(savedSearchState);
        console.log("[TOURNAMENT-UI] Restoring saved lobby state:", parsedState);
        
        // Восстанавливаем состояние, если оно актуально (не старше 2 минут)
        const timestamp = parsedState.timestamp || 0;
        const now = Date.now();
        const twoMinutesInMs = 2 * 60 * 1000;
        
        if (now - timestamp < twoMinutesInMs) {
          dispatch({ type: 'SET_IS_SEARCHING', payload: true });
          dispatch({ type: 'SET_LOBBY_ID', payload: savedLobbyId });
          
          if (parsedState.readyCheckActive) {
            dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
          }
          
          // Загружаем актуальное состояние с сервера
          refreshLobbyData(savedLobbyId);
        } else {
          // Состояние устарело, удаляем его
          console.log("[TOURNAMENT-UI] Saved state is too old, removing it");
          localStorage.removeItem(LOBBY_STORAGE_KEY);
          localStorage.removeItem(SEARCH_STATE_KEY);
        }
      }
    } catch (err) {
      console.error("[TOURNAMENT-UI] Error restoring saved lobby state:", err);
      localStorage.removeItem(LOBBY_STORAGE_KEY);
      localStorage.removeItem(SEARCH_STATE_KEY);
    }
  }, []);

  // Сохраняем состояние в localStorage при изменении
  useEffect(() => {
    if (state.lobbyId && state.isSearching) {
      localStorage.setItem(LOBBY_STORAGE_KEY, state.lobbyId);
      
      // Сохраняем только основные данные и временную метку
      const stateToSave = {
        readyCheckActive: state.readyCheckActive,
        timestamp: Date.now()
      };
      
      localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(stateToSave));
    } else if (!state.isSearching) {
      // Если поиск отменен, удаляем данные из localStorage
      localStorage.removeItem(LOBBY_STORAGE_KEY);
      localStorage.removeItem(SEARCH_STATE_KEY);
    }
  }, [state.lobbyId, state.isSearching, state.readyCheckActive]);

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
      
      // Если лобби больше не существует или имеет некорректный статус, сбрасываем поиск
      if (!lobbyStatus || (lobbyStatus.status !== 'waiting' && 
          lobbyStatus.status !== 'ready_check' && 
          lobbyStatus.status !== 'active')) {
        console.log("[TOURNAMENT-UI] Lobby no longer exists or has invalid status, resetting search");
        dispatch({ type: 'RESET_SEARCH' });
        localStorage.removeItem(LOBBY_STORAGE_KEY);
        localStorage.removeItem(SEARCH_STATE_KEY);
        return;
      }
      
      dispatch({ 
        type: 'SET_READY_CHECK_ACTIVE', 
        payload: lobbyStatus.status === 'ready_check' 
      });
      
      if (lobbyStatus.status === 'ready_check') {
        // Рассчитываем оставшееся время для проверки готовности
        let countdownSeconds = 120;
        if (lobbyStatus.ready_check_started_at) {
          const startTime = new Date(lobbyStatus.ready_check_started_at).getTime();
          const currentTime = new Date().getTime();
          const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
          countdownSeconds = Math.max(0, 120 - elapsedSeconds);
        }
        
        dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: countdownSeconds });
      }

      // Fetch participants
      const participants = await fetchLobbyParticipants(lobbyId);
      console.log("[TOURNAMENT-UI] Fetched participants:", 
        participants.map(p => ({
          id: p.user_id,
          username: p.profile?.username || 'Unknown'
        }))
      );
      
      // Проверяем, участвует ли текущий пользователь в лобби
      const { data: user } = await supabase.auth.getUser();
      const currentUserId = user?.user?.id;
      
      if (currentUserId) {
        const isUserInLobby = participants.some(p => 
          p.user_id === currentUserId && 
          (p.status === 'searching' || p.status === 'ready')
        );
        
        if (!isUserInLobby) {
          console.log("[TOURNAMENT-UI] User is no longer in lobby, resetting search");
          dispatch({ type: 'RESET_SEARCH' });
          localStorage.removeItem(LOBBY_STORAGE_KEY);
          localStorage.removeItem(SEARCH_STATE_KEY);
          return;
        }
      }
      
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
