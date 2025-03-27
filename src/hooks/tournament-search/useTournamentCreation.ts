
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { checkAllPlayersReady } from '@/services/tournament';
import { TournamentSearchState } from './types';
import { TournamentSearchAction } from './reducer';

export function useTournamentCreation(
  state: TournamentSearchState,
  dispatch: React.Dispatch<TournamentSearchAction>,
  handleCancelSearch: () => Promise<void>
) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Monitor for the trigger to check tournament creation
  useEffect(() => {
    if (state.checkTournamentTrigger && !state.isCreatingTournament) {
      checkTournamentCreation();
      // Reset the trigger
      dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: false });
    }
  }, [state.checkTournamentTrigger]);
  
  // If we have a tournament ID, navigate to it
  useEffect(() => {
    if (state.tournamentId) {
      console.log(`[TOURNAMENT-UI] Tournament ID is set, navigating to /tournaments/${state.tournamentId}`);
      
      toast({
        title: "Турнир начинается!",
        description: "Все игроки готовы. Переход к турниру...",
        variant: "default",
      });
      
      setTimeout(() => {
        navigate(`/tournaments/${state.tournamentId}`);
      }, 1000);
    }
  }, [state.tournamentId, navigate, toast]);
  
  const checkTournamentCreation = useCallback(async () => {
    const { lobbyId, isCreatingTournament, creationAttempts, tournamentId } = state;
    
    if (!lobbyId || isCreatingTournament || tournamentId) return;
    
    console.log(`[TOURNAMENT-UI] Checking tournament creation for lobby ${lobbyId}`);
    
    try {
      dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: true });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'checking' });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await checkAllPlayersReady(lobbyId);
      
      if (result.allReady && result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players ready, tournament created: ${result.tournamentId}`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        dispatch({ type: 'SET_TOURNAMENT_ID', payload: result.tournamentId });
      } else if (result.allReady && !result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players are ready but tournament creation failed`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
        
        if (creationAttempts >= 3) {
          toast({
            title: "Ошибка создания турнира",
            description: "Не удалось создать турнир после нескольких попыток. Поиск отменен.",
            variant: "destructive",
          });
          
          setTimeout(() => {
            handleCancelSearch();
          }, 3000);
        } else {
          dispatch({ type: 'SET_CREATION_ATTEMPTS', payload: creationAttempts + 1 });
          toast({
            title: "Повторная попытка",
            description: "Пытаемся создать турнир еще раз...",
            variant: "default",
          });
          
          setTimeout(() => {
            dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
            dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
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
  }, [state, dispatch, toast, navigate, handleCancelSearch]);
  
  return { checkTournamentCreation };
}
