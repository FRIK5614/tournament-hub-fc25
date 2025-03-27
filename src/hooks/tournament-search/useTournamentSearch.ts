
import { useReducer, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  searchForQuickTournament, 
  markUserAsReady, 
  leaveQuickTournament 
} from '@/services/tournament';
import { UseTournamentSearchResult } from './types';
import { initialState, tournamentSearchReducer } from './reducer';
import { useTournamentCreation } from './useTournamentCreation';
import { fetchLobbyStatus, fetchLobbyParticipants, setupLobbySubscriptions } from './utils';

export { LobbyParticipant } from './types';

export function useTournamentSearch(): UseTournamentSearchResult {
  const [state, dispatch] = useReducer(tournamentSearchReducer, initialState);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch current user ID
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          dispatch({ type: 'SET_CURRENT_USER_ID', payload: data.user.id });
          console.log(`[TOURNAMENT-UI] Current user ID: ${data.user.id}`);
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error fetching user:", error);
      }
    };
    
    fetchUser();
  }, []);

  // Handle cancelling search
  const handleCancelSearch = useCallback(async () => {
    if (!state.lobbyId) {
      dispatch({ type: 'SET_SEARCHING', payload: false });
      dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: 0 });
      return;
    }
    
    try {
      console.log(`[TOURNAMENT-UI] Cancelling search for lobby ${state.lobbyId}`);
      dispatch({ type: 'SET_LOADING', payload: true });
      
      if (state.currentUserId) {
        await leaveQuickTournament(state.lobbyId);
        console.log(`[TOURNAMENT-UI] User ${state.currentUserId} left lobby ${state.lobbyId}`);
      }
      
      dispatch({ type: 'RESET_SEARCH' });
      
      toast({
        title: "Поиск отменен",
        description: "Вы вышли из поиска турнира",
        variant: "default",
      });
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error canceling search:", error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.lobbyId, state.currentUserId, toast]);

  const { checkTournamentCreation } = useTournamentCreation(state, dispatch, handleCancelSearch);

  // Lobby subscription and participants tracking
  useEffect(() => {
    if (!state.lobbyId) return;

    const fetchLobbyData = async () => {
      try {
        // Fetch lobby status
        const lobbyData = await fetchLobbyStatus(state.lobbyId);
        
        if (lobbyData.tournament_id) {
          console.log(`[TOURNAMENT-UI] Tournament ID found, navigating to: ${lobbyData.tournament_id}`);
          
          toast({
            title: "Турнир начинается!",
            description: "Все игроки готовы. Переход к турниру...",
            variant: "default",
          });
          
          setTimeout(() => {
            navigate(`/tournaments/${lobbyData.tournament_id}`);
          }, 500);
          return;
        }
        
        // Fetch participants
        const participants = await fetchLobbyParticipants(state.lobbyId);
        
        const activePlayers = participants.length;
        const isReadyCheckActive = lobbyData.status === 'ready_check' && 
                                  activePlayers === lobbyData.max_players;
        
        dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: isReadyCheckActive });
        
        if (isReadyCheckActive && !state.readyCheckActive && activePlayers === 4) {
          toast({
            title: "Игроки найдены!",
            description: "Подтвердите свою готовность к началу турнира.",
            variant: "default",
          });
          
          // Reset the countdown
          dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });
        }
        
        if (participants.length > 0) {
          participants.forEach(p => {
            console.log(`[TOURNAMENT-UI] Participant in ${state.lobbyId}: userId=${p.user_id}, isReady=${p.is_ready}, status=${p.status}`);
          });
          
          dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: participants });
          
          const readyPlayerIds = participants
            .filter(p => p.is_ready && p.status === 'ready')
            .map(p => p.user_id) || [];
          dispatch({ type: 'SET_READY_PLAYERS', payload: readyPlayerIds });
          
          console.log(`[TOURNAMENT-UI] Ready players: ${readyPlayerIds.length}/${participants.length}`);
          
          if (readyPlayerIds.length === 4 && 
              participants.length === 4 && 
              isReadyCheckActive && 
              !state.isCreatingTournament) {
            console.log(`[TOURNAMENT-UI] All 4 players are ready. Triggering tournament creation check`);
            setTimeout(() => { checkTournamentCreation(); }, 500);
          }
        } else {
          dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: [] });
          dispatch({ type: 'SET_READY_PLAYERS', payload: [] });
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error in fetchLobbyData:", error);
      }
    };

    // Initial fetch
    fetchLobbyData();
    
    // Set up subscriptions
    const cleanupSubscriptions = setupLobbySubscriptions(state.lobbyId, fetchLobbyData);
    
    return cleanupSubscriptions;
  }, [state.lobbyId, state.readyCheckActive, state.isCreatingTournament, navigate, toast, checkTournamentCreation]);

  // Retry search if needed
  useEffect(() => {
    if (state.isSearching && !state.lobbyId && state.searchAttempts > 0 && state.searchAttempts < 5) {
      const retryTimer = setTimeout(() => {
        console.log(`[TOURNAMENT-UI] Retrying search, attempt #${state.searchAttempts + 1}`);
        handleStartSearch(true);
      }, 2000);
      
      return () => clearTimeout(retryTimer);
    }
    
    if (state.searchAttempts >= 5) {
      dispatch({ type: 'SET_SEARCHING', payload: false });
      dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: 0 });
      
      toast({
        title: "Не удалось найти турнир",
        description: "Слишком много попыток. Пожалуйста, попробуйте позже.",
        variant: "destructive",
      });
    }
  }, [state.isSearching, state.lobbyId, state.searchAttempts, toast]);

  // Ready check countdown
  useEffect(() => {
    if (!state.readyCheckActive || state.countdownSeconds <= 0) return;
    
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: state.countdownSeconds - 1 });
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [state.readyCheckActive, state.countdownSeconds]);

  // Handle countdown expiration
  useEffect(() => {
    if (state.readyCheckActive && state.countdownSeconds === 0) {
      handleCancelSearch();
      toast({
        title: "Время истекло",
        description: "Не все игроки подтвердили готовность. Поиск отменен.",
        variant: "destructive",
      });
    }
  }, [state.countdownSeconds, state.readyCheckActive, toast, handleCancelSearch]);

  // Start search for tournament
  const handleStartSearch = useCallback(async (isRetry = false) => {
    try {
      console.log(`[TOURNAMENT-UI] Starting tournament search${isRetry ? ' (retry)' : ''}`);
      dispatch({ type: 'SET_SEARCHING', payload: true });
      dispatch({ type: 'SET_LOADING', payload: true });
      
      if (!isRetry) {
        toast({
          title: "Поиск турнира",
          description: "Поиск быстрого турнира начат. Ожидание других игроков...",
          variant: "default",
        });
      }
      
      const newLobbyId = await searchForQuickTournament();
      dispatch({ type: 'SET_LOBBY_ID', payload: newLobbyId });
      console.log(`[TOURNAMENT-UI] Joined lobby: ${newLobbyId}`);
      
      dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: 0 });
    } catch (error: any) {
      console.error("[TOURNAMENT-UI] Error searching for tournament:", error);
      
      if (state.searchAttempts < 3) {
        toast({
          title: "Повторная попытка поиска",
          description: "Возникла проблема при поиске. Пробуем еще раз...",
          variant: "default",
        });
      }
      
      dispatch({ type: 'SET_SEARCH_ATTEMPTS', payload: state.searchAttempts + 1 });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.searchAttempts, toast]);

  // Handle user ready check
  const handleReadyCheck = useCallback(async () => {
    if (!state.lobbyId || state.isLoading) return;
    
    try {
      console.log(`[TOURNAMENT-UI] Marking user as ready in lobby ${state.lobbyId}`);
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const result = await markUserAsReady(state.lobbyId);
      console.log(`[TOURNAMENT-UI] Mark ready result:`, result);
      
      if (state.currentUserId) {
        dispatch({ type: 'ADD_READY_PLAYER', payload: state.currentUserId });
      }
      
      toast({
        title: "Готовность подтверждена",
        description: "Ожидание подтверждения других игроков...",
        variant: "default",
      });
      
      if (result.allReady && result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players ready after marking this user. Tournament ID: ${result.tournamentId}`);
        
        toast({
          title: "Турнир начинается!",
          description: "Все игроки готовы. Переход к турниру...",
          variant: "default",
        });
        
        setTimeout(() => {
          navigate(`/tournaments/${result.tournamentId}`);
        }, 800);
      } else if (state.readyPlayers.length + 1 >= 3 && !state.isCreatingTournament) {
        // If this might complete the ready player set, check for tournament creation
        console.log(`[TOURNAMENT-UI] May have all players ready now. Checking tournament creation...`);
        setTimeout(() => {
          checkTournamentCreation();
        }, 800);
      }
    } catch (error: any) {
      console.error("[TOURNAMENT-UI] Error marking as ready:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось подтвердить готовность",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [
    state.lobbyId, 
    state.isLoading, 
    state.currentUserId, 
    state.readyPlayers, 
    state.isCreatingTournament, 
    toast, 
    navigate, 
    checkTournamentCreation
  ]);

  // Check if current user is ready
  const isUserReady = useCallback(() => {
    return state.currentUserId ? state.readyPlayers.includes(state.currentUserId) : false;
  }, [state.currentUserId, state.readyPlayers]);

  return {
    isSearching: state.isSearching,
    lobbyId: state.lobbyId,
    readyCheckActive: state.readyCheckActive,
    countdownSeconds: state.countdownSeconds,
    lobbyParticipants: state.lobbyParticipants,
    readyPlayers: state.readyPlayers,
    isLoading: state.isLoading,
    tournamentCreationStatus: state.tournamentCreationStatus,
    isCreatingTournament: state.isCreatingTournament,
    currentUserId: state.currentUserId,
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady
  };
}
