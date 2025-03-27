
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
          
          // Проверяем и исправляем максимальное количество игроков в лобби
          const { data: lobby } = await supabase
            .from('tournament_lobbies')
            .select('max_players')
            .eq('id', state.lobbyId)
            .maybeSingle();
            
          if (lobby && lobby.max_players !== 4) {
            console.log("[TOURNAMENT-UI] Fixing lobby max_players to 4");
            await supabase
              .from('tournament_lobbies')
              .update({ max_players: 4 })
              .eq('id', state.lobbyId);
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
        // Проверка и исправление максимального количества игроков в лобби
        const { data: lobby } = await supabase
          .from('tournament_lobbies')
          .select('max_players, tournament_id')
          .eq('id', state.lobbyId)
          .maybeSingle();
          
        // Если лобби уже имеет tournament_id, значит турнир уже создан
        if (lobby?.tournament_id && !state.tournamentId) {
          console.log(`[TOURNAMENT-UI] Found existing tournament ${lobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
          return;
        }
          
        if (lobby && lobby.max_players !== 4) {
          console.log("[TOURNAMENT-UI] Fixing lobby max_players to 4");
          await supabase
            .from('tournament_lobbies')
            .update({ max_players: 4 })
            .eq('id', state.lobbyId);
        }
        
        // Проверка на наличие готовых игроков только если лобби полное
        if (state.lobbyParticipants.length === 4) {
          // Проверяем, что все игроки отметились как готовые
          const readyCount = state.readyPlayers.length;
          const allReady = readyCount === 4;
          
          console.log(`[TOURNAMENT-UI] Ready players: ${readyCount}/4, All ready: ${allReady}`);
          
          if (allReady && !state.isCreatingTournament && !state.tournamentId) {
            console.log("[TOURNAMENT-UI] All players are ready, triggering tournament creation");
            
            // Сначала проверяем, что турнир еще не существует
            const { data: updatedLobby } = await supabase
              .from('tournament_lobbies')
              .select('tournament_id')
              .eq('id', state.lobbyId)
              .maybeSingle();
              
            if (updatedLobby?.tournament_id) {
              console.log(`[TOURNAMENT-UI] Tournament already exists: ${updatedLobby.tournament_id}`);
              dispatch({ type: 'SET_TOURNAMENT_ID', payload: updatedLobby.tournament_id });
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
          const readyCount = state.readyPlayers.length;
          console.log(`[TOURNAMENT-UI] Countdown complete, ready players: ${readyCount}/${state.lobbyParticipants.length}`);
          
          if (readyCount === 4 && state.lobbyParticipants.length === 4) {
            console.log("[TOURNAMENT-UI] All players ready, creating tournament");
            
            // Сначала проверяем, что турнир уже существует
            const { data: lobby } = await supabase
              .from('tournament_lobbies')
              .select('tournament_id, max_players')
              .eq('id', state.lobbyId)
              .maybeSingle();
              
            if (lobby?.tournament_id) {
              console.log(`[TOURNAMENT-UI] Tournament already exists on countdown completion: ${lobby.tournament_id}`);
              dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
            } else {
              // Исправляем max_players, если нужно
              if (lobby && lobby.max_players !== 4) {
                console.log("[TOURNAMENT-UI] Fixing lobby max_players to 4");
                await supabase
                  .from('tournament_lobbies')
                  .update({ max_players: 4 })
                  .eq('id', state.lobbyId);
              }
              
              // Используем извлеченную логику checkTournamentCreation
              await checkTournamentCreation();
            }
          } else {
            toast({
              title: "Не все игроки готовы",
              description: `Готово только ${readyCount} из 4 игроков. Поиск отменен.`,
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
