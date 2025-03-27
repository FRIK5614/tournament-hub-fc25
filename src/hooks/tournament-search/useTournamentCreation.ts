
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { TournamentSearchState } from './types';
import { TournamentSearchAction } from './reducer';
import { supabase } from "@/integrations/supabase/client";
import { createTournamentWithRetry } from '@/services/tournament/lobby/tournamentCreationService';

export function useTournamentCreation(
  state: TournamentSearchState,
  dispatch: React.Dispatch<TournamentSearchAction>,
  handleCancelSearch: () => Promise<void>
) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const maxCreationAttempts = 3;
  const creationAttemptsRef = useRef(0);
  const navigationAttemptMadeRef = useRef(false);
  
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
    if (state.tournamentId && !navigationAttemptMadeRef.current) {
      console.log(`[TOURNAMENT-UI] Tournament ID is set, navigating to /tournaments/${state.tournamentId}`);
      navigationAttemptMadeRef.current = true;
      
      toast({
        title: "Турнир начинается!",
        description: "Все игроки готовы. Переход к турниру...",
        variant: "default",
      });
      
      // Immediate navigation with short safety timeout
      setTimeout(() => {
        navigate(`/tournaments/${state.tournamentId}`);
      }, 500);
    }
  }, [state.tournamentId, navigate, toast]);
  
  // Setup direct subscription to tournament_id changes on the lobby
  useEffect(() => {
    if (!state.lobbyId) return;
    
    console.log(`[TOURNAMENT-UI] Setting up subscription for tournament creation on lobby ${state.lobbyId}`);
    
    const channel = supabase
      .channel(`lobby_tournament_created_${state.lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_lobbies',
          filter: `id=eq.${state.lobbyId}`,
        },
        (payload) => {
          console.log('[TOURNAMENT-UI] Lobby updated:', payload);
          if (payload.new?.tournament_id && !state.tournamentId) {
            console.log(`[TOURNAMENT-UI] Tournament created: ${payload.new.tournament_id}`);
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: payload.new.tournament_id });
            
            // Mark tournament creation as complete
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
            dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
          }
        }
      )
      .subscribe();
      
    return () => {
      console.log(`[TOURNAMENT-UI] Cleaning up subscription for lobby ${state.lobbyId}`);
      supabase.removeChannel(channel);
    };
  }, [state.lobbyId, state.tournamentId, dispatch]);

  // Periodic check for tournament creation
  useEffect(() => {
    if (!state.lobbyId || state.tournamentId || !state.readyCheckActive) return;

    // Regular polling to check if tournament was created
    const checkForTournament = async () => {
      try {
        console.log(`[TOURNAMENT-UI] Polling for tournament ID on lobby ${state.lobbyId}`);
        
        const { data } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id, status')
          .eq('id', state.lobbyId)
          .maybeSingle();

        if (data?.tournament_id && !state.tournamentId) {
          console.log(`[TOURNAMENT-UI] Found tournament ID ${data.tournament_id} during polling`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: data.tournament_id });
          
          // Mark tournament creation as complete
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        }
        
        // Also check if all players are ready but tournament not created yet
        if (data?.status === 'ready_check' && !data?.tournament_id && state.lobbyParticipants.length === 4) {
          const allReady = state.lobbyParticipants.every(p => 
            state.readyPlayers.includes(p.user_id)
          );
          
          if (allReady && !state.isCreatingTournament) {
            console.log('[TOURNAMENT-UI] All players ready but no tournament, triggering creation');
            dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
          }
        }
      } catch (error) {
        console.error('[TOURNAMENT-UI] Error checking tournament:', error);
      }
    };

    const intervalId = setInterval(checkForTournament, 1500);
    return () => clearInterval(intervalId);
  }, [state.lobbyId, state.tournamentId, state.readyCheckActive, state.lobbyParticipants, state.readyPlayers, state.isCreatingTournament, dispatch]);
  
  const checkTournamentCreation = useCallback(async () => {
    const { lobbyId, isCreatingTournament, tournamentId } = state;
    
    if (!lobbyId || isCreatingTournament || tournamentId) return;
    
    console.log(`[TOURNAMENT-UI] Checking tournament creation for lobby ${lobbyId}`);
    
    try {
      dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: true });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'checking' });
      
      // First check if tournament already exists for this lobby
      const { data: existingLobby } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .single();
        
      if (existingLobby?.tournament_id) {
        console.log(`[TOURNAMENT-UI] Found existing tournament ${existingLobby.tournament_id}`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        dispatch({ type: 'SET_TOURNAMENT_ID', payload: existingLobby.tournament_id });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      // Verify all players are ready
      const { data: participants, error: participantsError } = await supabase
        .from('lobby_participants')
        .select('user_id, is_ready, status')
        .eq('lobby_id', lobbyId)
        .in('status', ['ready', 'searching']);
        
      if (participantsError) {
        console.error("[TOURNAMENT-UI] Error fetching participants:", participantsError);
        throw participantsError;
      }
        
      if (!participants || participants.length < 4) {
        console.log(`[TOURNAMENT-UI] Not enough participants: ${participants?.length || 0}/4`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      // Вывести информацию о всех игроках и их статусе для отладки
      console.log(`[TOURNAMENT-UI] Lobby participants:`, participants.map(p => ({ 
        id: p.user_id, 
        ready: p.is_ready, 
        status: p.status 
      })));
      
      const readyCount = participants.filter(p => p.is_ready).length;
      const inReadyStatusCount = participants.filter(p => p.status === 'ready').length;
      
      console.log(`[TOURNAMENT-UI] Ready players: ${readyCount}/4, In 'ready' status: ${inReadyStatusCount}/4`);
      
      if (readyCount < 4 || inReadyStatusCount < 4) {
        console.log(`[TOURNAMENT-UI] Not all players ready: ${readyCount}/4, Status 'ready': ${inReadyStatusCount}/4`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      console.log(`[TOURNAMENT-UI] All players are ready, attempting to create tournament`);
      
      // Use our service to create the tournament with retries
      try {
        const { tournamentId, created } = await createTournamentWithRetry(lobbyId);
        
        if (tournamentId) {
          console.log(`[TOURNAMENT-UI] Tournament created successfully: ${tournamentId}`);
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: tournamentId });
          dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
          return;
        }
      } catch (createError: any) {
        console.error("[TOURNAMENT-UI] Error in tournament creation:", createError);
        console.error("[TOURNAMENT-UI] Error details:", createError.message, createError.code, createError.details);
        
        // Increment creation attempts
        creationAttemptsRef.current += 1;
        dispatch({ type: 'SET_CREATION_ATTEMPTS', payload: creationAttemptsRef.current });
        
        if (creationAttemptsRef.current >= maxCreationAttempts) {
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
          toast({
            title: "Ошибка создания турнира",
            description: "После нескольких попыток не удалось создать турнир. Попробуйте еще раз.",
            variant: "destructive",
          });
          handleCancelSearch();
        } else {
          // Set status to failed and retry after delay
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
          dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
          
          setTimeout(() => {
            dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
          }, 2000);
        }
      }
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error in checkTournamentCreation:", error);
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
      dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
      
      toast({
        title: "Ошибка проверки лобби",
        description: "Не удалось проверить состояние лобби. Пожалуйста, попробуйте еще раз.",
        variant: "destructive",
      });
      
      setTimeout(() => {
        handleCancelSearch();
      }, 3000);
    }
  }, [state, dispatch, toast, handleCancelSearch, maxCreationAttempts]);
  
  return { checkTournamentCreation };
}
