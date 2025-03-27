
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
    console.log("[TOURNAMENT-UI] handleStartSearch called, isRetry:", isRetry);
    // Устанавливаем loading и сбрасываем предыдущее состояние поиска
    dispatch({ type: 'SET_LOADING', payload: true });
    if (!isRetry) {
      dispatch({ type: 'RESET_SEARCH' });
    }
    dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: isRetry ? state.searchAttempts + 1 : 0 });

    try {
      console.log("[TOURNAMENT-UI] Starting tournament search, isRetry:", isRetry);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error("Пользователь не авторизован");
      }
      
      console.log(`[TOURNAMENT-UI] Current user ID: ${user.user.id}`);
      dispatch({ type: 'SET_CURRENT_USER_ID', payload: user.user.id });

      // Устанавливаем isSearching=true до вызова API для мгновенного отображения UI
      dispatch({ type: 'SET_SEARCHING', payload: true });

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
        dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 120 });  // 2 minutes

        const initialParticipants = await fetchLobbyParticipants(lobbyId);
        console.log(`[TOURNAMENT-UI] Initial participants:`, initialParticipants);
        dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: initialParticipants });
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error fetching initial lobby data:", error);
      }

      // Установка состояний после успешного поиска
      dispatch({ type: 'SET_LOADING', payload: false });
      
      toast({
        title: "Поиск запущен",
        description: "Ищем других игроков для турнира...",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Ошибка при поиске лобби:", error);
      
      if (!isRetry) {
        toast({
          title: "Повторная попытка поиска",
          description: "Возникла проблема при поиске. Пробуем еще раз...",
          variant: "default",
        });
        
        setTimeout(() => {
          handleStartSearch(true);
        }, 2000);
      } else {
        // Сбрасываем состояние поиска при ошибке
        dispatch({ type: 'RESET_SEARCH' });
        
        // If retry also failed, show error to user
        toast({
          title: "Ошибка поиска",
          description: error.message || "Не удалось найти лобби. Попробуйте позже.",
          variant: "destructive",
        });
        dispatch({ type: 'SET_LOADING', payload: false });
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
