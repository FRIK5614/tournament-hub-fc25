
import { useReducer, useEffect, useCallback } from 'react';
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

export const useTournamentSearch = (): UseTournamentSearchResult => {
  const [state, dispatch] = useReducer(tournamentSearchReducer, initialState);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreateTournament = useCallback(async (lobbyId: string) => {
    try {
      dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: true });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'checking' });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await checkAllPlayersReady(lobbyId);
      
      if (result.allReady && result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players ready, tournament created: ${result.tournamentId}`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        
        toast({
          title: "Турнир начинается!",
          description: "Все игроки готовы. Переход к турниру...",
          variant: "default",
        });
        
        setTimeout(() => {
          navigate(`/tournaments/${result.tournamentId}`);
        }, 1000);
      } else if (result.allReady && !result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players are ready but tournament creation failed`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
        
        if (state.creationAttempts >= 3) {
          toast({
            title: "Ошибка создания турнира",
            description: "Не удалось создать турнир после нескольких попыток. Поиск отменен.",
            variant: "destructive",
          });
          
          setTimeout(() => {
            handleCancelSearch();
          }, 3000);
        } else {
          dispatch({ type: 'SET_CREATION_ATTEMPTS', payload: state.creationAttempts + 1 });
          toast({
            title: "Повторная попытка",
            description: "Пытаемся создать турнир еще раз...",
            variant: "default",
          });
          
          setTimeout(() => {
            dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
            handleCreateTournament(lobbyId);
          }, 2000);
        }
      } else {
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
      }
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error checking tournament creation:", error);
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
      
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при создании турнира. Поиск отменен.",
        variant: "destructive",
      });
      
      setTimeout(() => {
        handleCancelSearch();
      }, 3000);
    } finally {
      if (state.tournamentCreationStatus !== 'waiting') {
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
      }
    }
  }, [state, navigate, toast]);

  const handleStartSearch = useCallback(async (isRetry: boolean = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: isRetry ? state.searchAttempts + 1 : 0 });

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error("Пользователь не авторизован");
      }
      dispatch({ type: 'SET_CURRENT_USER_ID', payload: user.user.id });

      const { lobbyId } = await searchForQuickTournament(user.user.id);
      dispatch({ type: 'SET_LOBBY_ID', payload: lobbyId });
      
      // Fetch initial lobby status and participants
      const initialLobbyStatus = await fetchLobbyStatus(lobbyId);
      dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: initialLobbyStatus.status === 'ready_check' });
      dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });  // Default countdown value

      const initialParticipants = await fetchLobbyParticipants(lobbyId);
      dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: initialParticipants });

      // Setup real-time subscriptions
      const cleanupSubscription = setupLobbySubscriptions(lobbyId, () => {
        fetchLobbyStatus(lobbyId).then(status => {
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: status.status === 'ready_check' });
          fetchLobbyParticipants(lobbyId).then(participants => {
            dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: participants });
          });
        });
      });

      dispatch({ type: 'SET_SEARCHING', payload: true });
      dispatch({ type: 'SET_LOADING', payload: false });
      
      return () => {
        if (cleanupSubscription) {
          cleanupSubscription();
        }
      };
    } catch (error: any) {
      console.error("Ошибка при поиске лобби:", error);
      toast({
        title: "Ошибка поиска",
        description: error.message || "Не удалось начать поиск лобби",
        variant: "destructive",
      });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [toast]);

  const handleCancelSearch = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error("Пользователь не авторизован");
      }

      if (state.lobbyId) {
        await leaveQuickTournament(user.user.id, state.lobbyId);
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

      await markUserAsReady(user.user.id, state.lobbyId || '');
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

  useEffect(() => {
    if (state.countdownSeconds === 0 && state.readyCheckActive) {
      dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
      
      if (state.readyPlayers.length === state.lobbyParticipants.length) {
        handleCreateTournament(state.lobbyId || '');
      } else {
        toast({
          title: "Не все игроки готовы",
          description: "Не все игроки подтвердили готовность. Поиск отменен.",
          variant: "destructive",
        });
        handleCancelSearch();
      }
    }
  }, [state.countdownSeconds, state.readyCheckActive, state.readyPlayers, state.lobbyParticipants, handleCreateTournament, handleCancelSearch, toast]);

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
