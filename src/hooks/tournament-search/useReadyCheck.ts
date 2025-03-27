
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

  // Исправление десинхронизации состояний игроков и лобби при начале проверки готовности
  useEffect(() => {
    if (state.readyCheckActive && state.lobbyId && state.currentUserId) {
      const updateLobbyState = async () => {
        try {
          // Проверяем статус текущего игрока
          const { data: currentPlayer, error: playerError } = await supabase
            .from('lobby_participants')
            .select('status, is_ready')
            .eq('lobby_id', state.lobbyId)
            .eq('user_id', state.currentUserId)
            .maybeSingle();

          if (playerError) {
            console.error("[TOURNAMENT-UI] Error checking player status:", playerError);
            return;
          }

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
          const { data: lobby, error: lobbyError } = await supabase
            .from('tournament_lobbies')
            .select('max_players, status')
            .eq('id', state.lobbyId)
            .maybeSingle();
            
          if (lobbyError) {
            console.error("[TOURNAMENT-UI] Error checking lobby:", lobbyError);
            return;
          }
            
          if (lobby) {
            // Комплексное исправление лобби
            const updates: Record<string, any> = {};
            
            if (lobby.max_players !== 4) {
              console.log("[TOURNAMENT-UI] Fixing lobby max_players to 4");
              updates.max_players = 4;
            }
            
            // Если статус должен быть ready_check при активной проверке готовности
            if (state.readyCheckActive && lobby.status !== 'ready_check') {
              console.log("[TOURNAMENT-UI] Fixing lobby status to ready_check");
              updates.status = 'ready_check';
              updates.ready_check_started_at = new Date().toISOString();
            }
            
            // Применяем обновления, если они есть
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('tournament_lobbies')
                .update(updates)
                .eq('id', state.lobbyId);
            }
          }
        } catch (error) {
          console.error("[TOURNAMENT-UI] Error syncing player and lobby state:", error);
        }
      };
      
      updateLobbyState();
    }
  }, [state.readyCheckActive, state.lobbyId, state.currentUserId]);

  // Периодическая проверка, все ли игроки готовы
  useEffect(() => {
    if (!state.readyCheckActive || !state.lobbyId) return;
    
    const checkAllReady = async () => {
      try {
        // Проверяем авторизацию текущего пользователя
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          console.error("[TOURNAMENT-UI] Authentication required for ready check:", authError);
          return;
        }

        // Проверка и исправление лобби
        const { data: lobby, error: lobbyError } = await supabase
          .from('tournament_lobbies')
          .select('max_players, tournament_id, status, current_players')
          .eq('id', state.lobbyId)
          .maybeSingle();
          
        if (lobbyError) {
          console.error("[TOURNAMENT-UI] Error checking lobby status:", lobbyError);
          toast({
            title: "Ошибка проверки лобби",
            description: "Не удалось проверить состояние лобби. Попробуйте поиск снова.",
            variant: "destructive",
          });
          await handleCancelSearch();
          return;
        }
          
        // Если лобби уже имеет tournament_id, значит турнир уже создан
        if (lobby?.tournament_id && !state.tournamentId) {
          console.log(`[TOURNAMENT-UI] Found existing tournament ${lobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
          return;
        }
          
        // Комплексная проверка и исправление лобби
        if (lobby) {
          const updates: Record<string, any> = {};
          let needsUpdate = false;
          
          if (lobby.max_players !== 4) {
            console.log("[TOURNAMENT-UI] Fixing lobby max_players to 4");
            updates.max_players = 4;
            needsUpdate = true;
          }
          
          if (state.readyCheckActive && lobby.status !== 'ready_check') {
            console.log("[TOURNAMENT-UI] Fixing lobby status to ready_check");
            updates.status = 'ready_check';
            updates.ready_check_started_at = new Date().toISOString();
            needsUpdate = true;
          }
          
          // Применяем обновления, если необходимо
          if (needsUpdate) {
            await supabase
              .from('tournament_lobbies')
              .update(updates)
              .eq('id', state.lobbyId);
          }
          
          // Получаем актуальное количество игроков в лобби
          const { data: participants, error: participantsError } = await supabase
            .from('lobby_participants')
            .select('user_id, is_ready, status')
            .eq('lobby_id', state.lobbyId)
            .in('status', ['ready', 'searching']);
          
          if (participantsError) {
            console.error("[TOURNAMENT-UI] Error fetching participants:", participantsError);
            return;
          }
          
          const totalParticipants = participants?.length || 0;
          const readyParticipants = participants?.filter(p => p.is_ready).length || 0;
          
          console.log(`[TOURNAMENT-UI] Participants: ${totalParticipants}/4, Ready: ${readyParticipants}/4`);
          
          // Проверка на наличие готовых игроков только если лобби полное (4 игрока)
          if (totalParticipants === 4) {
            // Если все игроки готовы, запускаем создание турнира
            const allReady = readyParticipants === 4;
            
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
          } else if (totalParticipants < 4 && lobby.status === 'ready_check') {
            // Если игроков меньше 4, но статус ready_check - исправляем на waiting
            console.log(`[TOURNAMENT-UI] Not enough players (${totalParticipants}/4), resetting to waiting`);
            await supabase
              .from('tournament_lobbies')
              .update({ 
                status: 'waiting', 
                ready_check_started_at: null,
                current_players: totalParticipants
              })
              .eq('id', state.lobbyId);
              
            // Сбрасываем флаг активной проверки готовности
            dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
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
    dispatch,
    handleCancelSearch,
    toast
  ]);

  // Обработка завершения обратного отсчета
  useEffect(() => {
    // Если отсчет завершился и проверка готовности активна
    if (state.countdownSeconds === 0 && state.readyCheckActive) {
      const handleCountdownComplete = async () => {
        try {
          // Проверяем авторизацию текущего пользователя
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError || !authData?.user) {
            console.error("[TOURNAMENT-UI] Authentication required for tournament creation:", authError);
            toast({
              title: "Требуется авторизация",
              description: "Для создания турнира необходимо авторизоваться",
              variant: "destructive",
            });
            await handleCancelSearch();
            return;
          }

          // Проверяем, все ли игроки готовы
          const readyCount = state.readyPlayers.length;
          console.log(`[TOURNAMENT-UI] Countdown complete, ready players: ${readyCount}/${state.lobbyParticipants.length}`);
          
          if (readyCount === 4 && state.lobbyParticipants.length === 4) {
            console.log("[TOURNAMENT-UI] All players ready, creating tournament");
            
            // Сначала проверяем, что турнир еще не существует
            const { data: lobby, error: lobbyError } = await supabase
              .from('tournament_lobbies')
              .select('tournament_id, max_players, status')
              .eq('id', state.lobbyId)
              .maybeSingle();
              
            if (lobbyError) {
              console.error("[TOURNAMENT-UI] Error checking lobby:", lobbyError);
              throw new Error("Не удалось проверить статус лобби");
            }
              
            if (lobby?.tournament_id) {
              console.log(`[TOURNAMENT-UI] Tournament already exists on countdown completion: ${lobby.tournament_id}`);
              dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
            } else {
              // Исправляем параметры лобби, если нужно
              const updates: Record<string, any> = {};
              let needsUpdate = false;
              
              if (lobby && lobby.max_players !== 4) {
                console.log("[TOURNAMENT-UI] Fixing lobby max_players to 4");
                updates.max_players = 4;
                needsUpdate = true;
              }
              
              if (lobby && lobby.status !== 'ready_check') {
                console.log("[TOURNAMENT-UI] Fixing lobby status to ready_check");
                updates.status = 'ready_check';
                updates.ready_check_started_at = new Date().toISOString();
                needsUpdate = true;
              }
              
              if (needsUpdate) {
                await supabase
                  .from('tournament_lobbies')
                  .update(updates)
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
        } catch (error: any) {
          console.error("[TOURNAMENT-UI] Error handling countdown completion:", error);
          
          toast({
            title: "Ошибка создания турнира",
            description: error.message || "Произошла ошибка при создании турнира",
            variant: "destructive",
          });
          
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
