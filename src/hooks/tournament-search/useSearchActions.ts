
import { useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  searchForQuickTournament, 
  markUserAsReady, 
  leaveQuickTournament
} from '@/services/tournament';
import { TournamentSearchState } from './types';
import { TournamentSearchAction } from './reducer';
import { fetchLobbyStatus, fetchLobbyParticipants } from './utils';

export const useSearchActions = (
  state: TournamentSearchState,
  dispatch: React.Dispatch<TournamentSearchAction>,
  setupCleanupFunction: (cleanup: () => void) => void,
  refreshLobbyData: (lobbyId: string) => Promise<void>
) => {
  const { toast } = useToast();

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
  }, [state.lobbyId, toast, dispatch]);
  
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
  }, [state.lobbyId, toast, dispatch]);

  const isUserReady = useCallback(() => {
    return state.readyPlayers.includes(state.currentUserId || '');
  }, [state.readyPlayers, state.currentUserId]);

  const handleStartSearch = useCallback(async (isRetry: boolean = false): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: isRetry ? state.searchAttempts + 1 : 0 });

    try {
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
      }

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
      if (!isRetry) {
        toast({
          title: "Повторная попытка поиска",
          description: "Возникла проблема при поиске. Пробуем еще раз...",
          variant: "default",
        });
        
        // Automatically retry after a short delay (only once)
        setTimeout(() => {
          handleStartSearch(true);
        }, 2000);
      }
    }
  }, [toast, state.searchAttempts, dispatch]);

  return {
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady
  };
};
