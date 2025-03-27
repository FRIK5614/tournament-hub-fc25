
import { useEffect } from 'react';
import { TournamentSearchState } from './types';
import { TournamentSearchAction } from './reducer';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useReadyCheck = (
  state: TournamentSearchState,
  dispatch: React.Dispatch<TournamentSearchAction>,
  handleCancelSearch: () => Promise<void>,
  checkTournamentCreation: () => Promise<void>
) => {
  const { toast } = useToast();

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
  }, [state.readyCheckActive, state.countdownSeconds, dispatch]);

  // Fix desynchronized player states when ready check begins
  useEffect(() => {
    if (state.readyCheckActive && state.lobbyId && state.currentUserId) {
      const updatePlayerState = async () => {
        try {
          // Check current player's status
          const { data: currentPlayer } = await supabase
            .from('lobby_participants')
            .select('status, is_ready')
            .eq('lobby_id', state.lobbyId)
            .eq('user_id', state.currentUserId)
            .maybeSingle();

          // If player is in 'searching' status when ready check is active, update it to 'ready'
          if (currentPlayer && currentPlayer.status === 'searching') {
            console.log("[TOURNAMENT-UI] Fixing player status to 'ready' during ready check");
            await supabase
              .from('lobby_participants')
              .update({ status: 'ready' })
              .eq('lobby_id', state.lobbyId)
              .eq('user_id', state.currentUserId);
          }
        } catch (error) {
          console.error("[TOURNAMENT-UI] Error syncing player state:", error);
        }
      };
      
      updatePlayerState();
    }
  }, [state.readyCheckActive, state.lobbyId, state.currentUserId]);

  // Check if all players are ready periodically
  useEffect(() => {
    if (state.readyCheckActive && state.lobbyId && state.lobbyParticipants.length === 4) {
      const checkAllReady = async () => {
        try {
          const allReady = state.lobbyParticipants.every(p => 
            state.readyPlayers.includes(p.user_id)
          );
          
          if (allReady && !state.isCreatingTournament && !state.tournamentId) {
            console.log("[TOURNAMENT-UI] All players are ready, triggering tournament creation");
            
            // First verify no tournament exists yet
            const { data: lobby } = await supabase
              .from('tournament_lobbies')
              .select('tournament_id')
              .eq('id', state.lobbyId)
              .maybeSingle();
              
            if (lobby?.tournament_id) {
              console.log(`[TOURNAMENT-UI] Tournament already exists: ${lobby.tournament_id}`);
              dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
            } else {
              dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
            }
          }
        } catch (error) {
          console.error("[TOURNAMENT-UI] Error checking player readiness:", error);
        }
      };
      
      // Check immediately and then every second
      checkAllReady();
      const intervalId = setInterval(checkAllReady, 1000);
      
      return () => clearInterval(intervalId);
    }
  }, [
    state.readyCheckActive, 
    state.lobbyId, 
    state.lobbyParticipants, 
    state.readyPlayers, 
    state.isCreatingTournament,
    state.tournamentId,
    dispatch
  ]);

  // Handle countdown completion
  useEffect(() => {
    if (state.countdownSeconds === 0 && state.readyCheckActive) {
      const handleCountdownComplete = async () => {
        try {
          // Don't reset ready check active flag yet, wait for tournament creation check
          // dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
          
          if (state.readyPlayers.length === state.lobbyParticipants.length) {
            // First check if tournament already exists
            const { data: lobby } = await supabase
              .from('tournament_lobbies')
              .select('tournament_id')
              .eq('id', state.lobbyId)
              .maybeSingle();
              
            if (lobby?.tournament_id) {
              console.log(`[TOURNAMENT-UI] Tournament already exists on countdown completion: ${lobby.tournament_id}`);
              dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
            } else {
              // Use the extracted checkTournamentCreation logic
              await checkTournamentCreation();
            }
          } else {
            toast({
              title: "Не все игроки готовы",
              description: "Не все игроки подтвердили готовность. Поиск отменен.",
              variant: "destructive",
            });
            await handleCancelSearch();
          }
          
          // Now reset the ready check active flag
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
        } catch (error) {
          console.error("[TOURNAMENT-UI] Error handling countdown completion:", error);
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
        }
      };
      
      handleCountdownComplete();
    }
  }, [
    state.countdownSeconds, 
    state.readyCheckActive, 
    state.readyPlayers, 
    state.lobbyParticipants, 
    state.lobbyId,
    checkTournamentCreation, 
    handleCancelSearch, 
    toast,
    dispatch
  ]);
};
