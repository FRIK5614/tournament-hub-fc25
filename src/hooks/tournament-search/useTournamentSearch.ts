
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
      // Always clean up any subscriptions when canceling
      if (cleanupSubscriptionRef.current) {
        cleanupSubscriptionRef.current();
        cleanupSubscriptionRef.current = null;
      }
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
      // Clean up any existing subscriptions before starting new search
      if (cleanupSubscriptionRef.current) {
        cleanupSubscriptionRef.current();
        cleanupSubscriptionRef.current = null;
      }
      
      console.log("[TOURNAMENT-UI] Starting tournament search, isRetry:", isRetry);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error("Пользователь не авторизован");
      }
      dispatch({ type: 'SET_CURRENT_USER_ID', payload: user.user.id });

      // Search for a quick tournament
      const { lobbyId } = await searchForQuickTournament();
      if (!lobbyId) {
        throw new Error("Не удалось найти подходящее лобби");
      }
      
      console.log(`[TOURNAMENT-UI] Found lobby: ${lobbyId}`);
      dispatch({ type: 'SET_LOBBY_ID', payload: lobbyId });
      
      // Fetch initial lobby status and participants
      try {
        const initialLobbyStatus = await fetchLobbyStatus(lobbyId);
        dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: initialLobbyStatus.status === 'ready_check' });
        dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });  // Default countdown value

        const initialParticipants = await fetchLobbyParticipants(lobbyId);
        dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: initialParticipants });
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error fetching initial lobby data:", error);
        // Continue anyway to avoid blocking the search process
      }

      // Setup real-time subscriptions - store the cleanup function in the ref
      const cleanup = setupLobbySubscriptions(lobbyId, () => {
        // Create an interval to poll for updates in case the realtime subscription fails
        const pollInterval = setInterval(async () => {
          try {
            const status = await fetchLobbyStatus(lobbyId);
            dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: status.status === 'ready_check' });
            const participants = await fetchLobbyParticipants(lobbyId);
            dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: participants });
            
            // Clear interval if we're no longer searching or have a successful connection
            if (!state.isSearching) {
              clearInterval(pollInterval);
            }
          } catch (error) {
            console.error("[TOURNAMENT-UI] Error polling lobby data:", error);
          }
        }, 3000); // Poll every 3 seconds
        
        return () => {
          clearInterval(pollInterval);
          console.log("[TOURNAMENT-UI] Polling interval cleared");
        };
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
      
      // Show retry toast after a failure
      toast({
        title: "Повторная попытка поиска",
        description: "Возникла проблема при поиске. Пробуем еще раз...",
        variant: "default",
      });
      
      // Automatically retry after a short delay (only once)
      if (!isRetry) {
        setTimeout(() => {
          handleStartSearch(true);
        }, 2000);
      }
    }
  }, [toast, state.searchAttempts, state.isSearching]);

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

  // Periodically refresh lobby data even if subscriptions fail
  useEffect(() => {
    if (state.isSearching && state.lobbyId) {
      const refreshInterval = setInterval(async () => {
        try {
          console.log(`[TOURNAMENT-UI] Periodic refresh of lobby ${state.lobbyId} data`);
          const status = await fetchLobbyStatus(state.lobbyId);
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: status.status === 'ready_check' });
          
          const participants = await fetchLobbyParticipants(state.lobbyId);
          console.log(`[TOURNAMENT-UI] Refreshed participants: ${participants.length}`);
          dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: participants });
        } catch (error) {
          console.error("[TOURNAMENT-UI] Error in periodic refresh:", error);
        }
      }, 5000); // Every 5 seconds
      
      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [state.isSearching, state.lobbyId]);

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
