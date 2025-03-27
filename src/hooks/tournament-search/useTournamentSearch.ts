
import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  searchForQuickTournament, 
  markUserAsReady, 
  leaveQuickTournament,
  checkAllPlayersReady
} from '@/services/tournament';
import { UseTournamentSearchResult, LobbyParticipant, TournamentSearchState } from './types';
import { initialState, tournamentSearchReducer } from './reducer';
import { fetchLobbyStatus, fetchLobbyParticipants, setupLobbySubscriptions } from './utils';
import { useTournamentCreation } from './useTournamentCreation';

export const useTournamentSearch = (): UseTournamentSearchResult => {
  const [state, dispatch] = useReducer(tournamentSearchReducer, initialState);
  const navigate = useNavigate();
  const { toast } = useToast();
  const cleanupSubscriptionRef = useRef<(() => void) | null>(null);

  // Use the extracted tournament creation logic
  const { checkTournamentCreation } = useTournamentCreation(state, dispatch, () => handleCancelSearch());

  const handleCancelSearch = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error("Пользователь не авторизован");
      }

      if (state.lobbyId) {
        await leaveQuickTournament(state.lobbyId);
      }
      dispatch({ type: 'RESET_SEARCH' });
      
      toast({
        title: "Поиск отменен",
        description: "Вы вышли из очереди поиска",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Ошибка при отмене поиска:", error);
      toast({
        title: "Ошибка отмены",
        description: error.message || "Не удалось отменить поиск",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.lobbyId, toast]);
  
  const handleReadyCheck = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error("Пользователь не авторизован");
      }

      await markUserAsReady(state.lobbyId || '');
      dispatch({ type: 'ADD_READY_PLAYER', payload: user.user.id });
      
      toast({
        title: "Готов!",
        description: "Вы подтвердили готовность к игре",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Ошибка при подтверждении готовности:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось подтвердить готовность",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.lobbyId, toast]);

  const isUserReady = useCallback(() => {
    return state.readyPlayers.includes(state.currentUserId || '');
  }, [state.readyPlayers, state.currentUserId]);

  const handleStartSearch = useCallback(async (isRetry: boolean = false): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: isRetry ? state.searchAttempts + 1 : 0 });

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error("Пользователь не авторизован");
      }
      dispatch({ type: 'SET_CURRENT_USER_ID', payload: user.user.id });

      const { lobbyId } = await searchForQuickTournament();
      if (!lobbyId) {
        throw new Error("Не удалось найти подходящее лобби");
      }
      
      dispatch({ type: 'SET_LOBBY_ID', payload: lobbyId });
      
      // Fetch initial lobby status and participants
      const initialLobbyStatus = await fetchLobbyStatus(lobbyId);
      dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: initialLobbyStatus.status === 'ready_check' });
      dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });  // Default countdown value

      const initialParticipants = await fetchLobbyParticipants(lobbyId);
      dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: initialParticipants });

      // Setup real-time subscriptions - store the cleanup function in the ref
      if (cleanupSubscriptionRef.current) {
        cleanupSubscriptionRef.current(); // Clean up existing subscription if any
      }
      
      const cleanup = setupLobbySubscriptions(lobbyId, () => {
        fetchLobbyStatus(lobbyId).then(status => {
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: status.status === 'ready_check' });
          fetchLobbyParticipants(lobbyId).then(participants => {
            dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: participants });
          });
        });
      });
      
      cleanupSubscriptionRef.current = cleanup;

      dispatch({ type: 'SET_SEARCHING', payload: true });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error: any) {
      console.error("Ошибка при поиске лобби:", error);
      toast({
        title: "Ошибка поиска",
        description: error.message || "Не удалось начать поиск лобби",
        variant: "destructive",
      });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [toast, state.searchAttempts]);

  // Effect to handle cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (cleanupSubscriptionRef.current) {
        cleanupSubscriptionRef.current();
      }
    };
  }, []);

  // Start countdown timer when ready check is active
  useEffect(() => {
    let countdownTimer: number | undefined;
    
    if (state.readyCheckActive && state.countdownSeconds > 0) {
      countdownTimer = window.setInterval(() => {
        dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: state.countdownSeconds - 1 });
      }, 1000);
    }
    
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, [state.readyCheckActive, state.countdownSeconds]);

  useEffect(() => {
    if (state.countdownSeconds === 0 && state.readyCheckActive) {
      dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
      
      if (state.readyPlayers.length === state.lobbyParticipants.length) {
        // Use the extracted checkTournamentCreation logic
        checkTournamentCreation();
      } else {
        toast({
          title: "Не все игроки готовы",
          description: "Не все игроки подтвердили готовность. Поиск отменен.",
          variant: "destructive",
        });
        handleCancelSearch();
      }
    }
  }, [state.countdownSeconds, state.readyCheckActive, state.readyPlayers, state.lobbyParticipants, checkTournamentCreation, handleCancelSearch, toast]);

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
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady,
  };
};
