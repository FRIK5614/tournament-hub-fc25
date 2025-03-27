
import { useEffect, useRef } from 'react';
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
  // Добавляем ref для отслеживания последнего состояния
  const lastStatusRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

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
      const syncLobbyState = async () => {
        try {
          // Проверяем авторизацию пользователя
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError || !authData?.user) {
            console.error("[TOURNAMENT-UI] Authentication error:", authError);
            return;
          }

          // Проверяем и исправляем статус текущего игрока
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
            .select('max_players, status, current_players')
            .eq('id', state.lobbyId)
            .maybeSingle();
            
          if (lobbyError) {
            console.error("[TOURNAMENT-UI] Error checking lobby:", lobbyError);
            return;
          }
            
          if (lobby) {
            // Комплексное исправление лобби
            const updates: Record<string, any> = {};
            let needsUpdate = false;
            
            if (lobby.max_players !== 4) {
              console.log("[TOURNAMENT-UI] Fixing lobby max_players to 4");
              updates.max_players = 4;
              needsUpdate = true;
            }
            
            // Если статус должен быть ready_check при активной проверке готовности
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
          }
        } catch (error) {
          console.error("[TOURNAMENT-UI] Error syncing player and lobby state:", error);
        }
      };
      
      syncLobbyState();
    }
  }, [state.readyCheckActive, state.lobbyId, state.currentUserId, dispatch]);

  // Модифицированная проверка состояния лобби с защитой от мигания состояний
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
        
        // Для предотвращения мигания состояний, сохраняем предыдущее состояние
        if (lastStatusRef.current === null) {
          lastStatusRef.current = lobby?.status || null;
        }
        
        // Используем debouncing для предотвращения частых переключений состояния
        if (lastStatusRef.current !== lobby?.status) {
          console.log(`[TOURNAMENT-UI] Lobby status changed from ${lastStatusRef.current} to ${lobby?.status}`);
          
          // Очищаем предыдущий таймер
          if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          
          // Устанавливаем новый таймер для применения изменения после задержки
          debounceTimerRef.current = window.setTimeout(() => {
            // Применяем изменение только если оно стабильно в течение задержки
            if (lobby?.status === 'ready_check' && lastStatusRef.current !== 'ready_check') {
              console.log("[TOURNAMENT-UI] Setting ready check active to true after debounce");
              dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
            } else if (lobby?.status === 'waiting' && lastStatusRef.current === 'ready_check') {
              console.log("[TOURNAMENT-UI] Setting ready check active to false after debounce");
              dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
            }
            
            lastStatusRef.current = lobby?.status || null;
            debounceTimerRef.current = null;
          }, 2000); // 2 секунды задержки для стабилизации состояния
        }
          
        // Если лобби найдено, но в нем меньше 4 игроков и оно в статусе ready_check
        if (lobby && lobby.current_players < 4 && lobby.status === 'ready_check') {
          // Проверяем, участвует ли текущий пользователь в лобби
          const { data: isUserInLobby } = await supabase
            .from('lobby_participants')
            .select('id')
            .eq('lobby_id', state.lobbyId)
            .eq('user_id', authData.user.id)
            .in('status', ['ready', 'searching'])
            .maybeSingle();
            
          // Только если пользователь все еще в лобби, сбрасываем статус
          if (isUserInLobby) {
            console.log(`[TOURNAMENT-UI] Not enough players (${lobby.current_players}/4), requesting reset to waiting`);
            
            // Проверяем, не изменилось ли состояние за последние секунды
            if (debounceTimerRef.current === null) {
              await supabase
                .from('tournament_lobbies')
                .update({ 
                  status: 'waiting', 
                  ready_check_started_at: null,
                  current_players: lobby.current_players
                })
                .eq('id', state.lobbyId);
                
              // Сбрасываем флаг активной проверки готовности
              dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
            }
          }
          
          return;
        }
        
        // Комплексная проверка и исправление лобби, только если текущий пользователь в лобби
        if (lobby) {
          // Проверяем участие пользователя в лобби
          const { data: isUserInLobby } = await supabase
            .from('lobby_participants')
            .select('id, status, is_ready')
            .eq('lobby_id', state.lobbyId)
            .eq('user_id', authData.user.id)
            .in('status', ['ready', 'searching'])
            .maybeSingle();
            
          if (!isUserInLobby) {
            console.log("[TOURNAMENT-UI] User no longer in lobby, skipping lobby fixes");
            return;
          }
          
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
          
          // Важно: игроки могут быть is_ready=true, но иметь статус 'searching'
          // Исправляем это несоответствие
          for (const participant of participants || []) {
            if (participant.is_ready && participant.status === 'searching') {
              console.log(`[TOURNAMENT-UI] Fixing status for ready player ${participant.user_id}`);
              await supabase
                .from('lobby_participants')
                .update({ status: 'ready' })
                .eq('lobby_id', state.lobbyId)
                .eq('user_id', participant.user_id)
                .eq('is_ready', true);
            }
          }
          
          // После исправлений снова получаем список игроков
          const { data: updatedParticipants } = await supabase
            .from('lobby_participants')
            .select('user_id, is_ready, status')
            .eq('lobby_id', state.lobbyId)
            .in('status', ['ready', 'searching']);
            
          const readyParticipants = (updatedParticipants || [])
            .filter(p => p.is_ready && p.status === 'ready').length;
          
          // Обновляем список готовых игроков в состоянии
          const readyPlayerIds = (updatedParticipants || [])
            .filter(p => p.is_ready)
            .map(p => p.user_id);
            
          if (JSON.stringify(readyPlayerIds) !== JSON.stringify(state.readyPlayers)) {
            dispatch({ type: 'SET_READY_PLAYERS', payload: readyPlayerIds });
          }
          
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
                // Используем извлеченную логику создания турнира
                await checkTournamentCreation();
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
    
    // Проверка сразу и затем каждые 3 секунды (увеличиваем интервал для снижения нагрузки)
    checkAllReady();
    const intervalId = setInterval(checkAllReady, 3000);
    
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
    toast,
    checkTournamentCreation
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
              .select('tournament_id, max_players, status, current_players')
              .eq('id', state.lobbyId)
              .maybeSingle();
              
            if (lobbyError) {
              console.error("[TOURNAMENT-UI] Error checking lobby:", lobbyError);
              throw new Error("Не удалось проверить статус лобби");
            }
              
            if (lobby?.tournament_id) {
              console.log(`[TOURNAMENT-UI] Tournament already exists on countdown completion: ${lobby.tournament_id}`);
              dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
            } else if (lobby?.current_players < 4) {
              console.log(`[TOURNAMENT-UI] Not enough players (${lobby.current_players}/4), cancelling tournament creation`);
              toast({
                title: "Недостаточно игроков",
                description: `В лобби только ${lobby.current_players} из 4 игроков. Поиск отменен.`,
                variant: "destructive",
              });
              await handleCancelSearch();
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
