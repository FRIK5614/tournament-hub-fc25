
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

  // Установка таймера обратного отсчета, когда проверка готовности активна
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

  // Исправление десинхронизации состояний игроков при начале проверки готовности
  useEffect(() => {
    if (state.readyCheckActive && state.lobbyId && state.currentUserId) {
      const updatePlayerState = async () => {
        try {
          // Проверяем статус текущего игрока
          const { data: currentPlayer } = await supabase
            .from('lobby_participants')
            .select('status, is_ready')
            .eq('lobby_id', state.lobbyId)
            .eq('user_id', state.currentUserId)
            .maybeSingle();

          // Если игрок в статусе 'searching' во время проверки готовности, обновляем его до 'ready'
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

  // Периодическая проверка, все ли игроки готовы
  useEffect(() => {
    if (!state.readyCheckActive || !state.lobbyId) return;
    
    const checkAllReady = async () => {
      try {
        // Проверка на наличие готовых игроков только если количество участников = 4
        if (state.lobbyParticipants.length === 4) {
          const allReady = state.lobbyParticipants.every(p => 
            state.readyPlayers.includes(p.user_id)
          );
          
          if (allReady && !state.isCreatingTournament && !state.tournamentId) {
            console.log("[TOURNAMENT-UI] All players are ready, triggering tournament creation");
            
            // Сначала проверяем, что турнир еще не существует
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
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error checking player readiness:", error);
      }
    };
    
    // Проверка сразу и затем каждую секунду
    checkAllReady();
    const intervalId = setInterval(checkAllReady, 1000);
    
    return () => clearInterval(intervalId);
  }, [
    state.readyCheckActive, 
    state.lobbyId, 
    state.lobbyParticipants, 
    state.readyPlayers, 
    state.isCreatingTournament,
    state.tournamentId,
    dispatch
  ]);

  // Обработка завершения обратного отсчета
  useEffect(() => {
    // Если отсчет завершился и игра в режиме ожидания готовности
    if (state.countdownSeconds === 0 && state.readyCheckActive) {
      const handleCountdownComplete = async () => {
        try {
          // Проверяем, все ли игроки готовы
          if (state.readyPlayers.length === state.lobbyParticipants.length && state.lobbyParticipants.length === 4) {
            console.log("[TOURNAMENT-UI] All players ready, creating tournament");
            
            // Сначала проверяем, что турнир уже существует
            const { data: lobby } = await supabase
              .from('tournament_lobbies')
              .select('tournament_id')
              .eq('id', state.lobbyId)
              .maybeSingle();
              
            if (lobby?.tournament_id) {
              console.log(`[TOURNAMENT-UI] Tournament already exists on countdown completion: ${lobby.tournament_id}`);
              dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
            } else {
              // Используем извлеченную логику checkTournamentCreation
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
          
          // Сбрасываем флаг активной проверки готовности
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
        } catch (error) {
          console.error("[TOURNAMENT-UI] Error handling countdown completion:", error);
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
          await handleCancelSearch();
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
