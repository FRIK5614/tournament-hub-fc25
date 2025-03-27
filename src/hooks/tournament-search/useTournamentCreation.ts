
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TournamentSearchState } from './types';
import { TournamentSearchAction } from './reducer';
import { createTournamentWithRetry } from '@/services/tournament';
import { useCallback } from "react";

export const useTournamentCreation = (
  state: TournamentSearchState,
  dispatch: React.Dispatch<TournamentSearchAction>,
  handleCancelSearch: () => Promise<void>
) => {
  const { toast } = useToast();

  const checkTournamentCreation = useCallback(async () => {
    try {
      if (state.isCreatingTournament || !state.lobbyId) {
        console.log("[TOURNAMENT-UI] Tournament creation already in progress or no lobby");
        return;
      }

      // Проверка авторизации
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        console.error("[TOURNAMENT-UI] Authentication required:", authError);
        toast({
          title: "Требуется авторизация",
          description: "Для создания турнира необходимо авторизоваться",
          variant: "destructive",
        });
        return;
      }

      // Проверяем, все ли игроки готовы
      if (state.readyPlayers.length < 4 || state.lobbyParticipants.length < 4) {
        console.log(`[TOURNAMENT-UI] Not enough ready players: ${state.readyPlayers.length}/${state.lobbyParticipants.length}`);
        return;
      }

      console.log("[TOURNAMENT-UI] Initiating tournament creation");
      dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: true });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'checking' });

      // Дважды проверяем, что турнир еще не был создан
      const { data: lobby, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id, max_players, status, current_players')
        .eq('id', state.lobbyId)
        .maybeSingle();
        
      if (lobbyError) {
        console.error("[TOURNAMENT-UI] Error checking lobby status:", lobbyError);
        throw new Error("Не удалось проверить статус лобби");
      }
        
      if (lobby?.tournament_id) {
        console.log(`[TOURNAMENT-UI] Tournament already exists: ${lobby.tournament_id}`);
        dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
        dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        return;
      }

      // Проверяем еще раз количество игроков в лобби
      if (lobby && lobby.current_players < 4) {
        console.log(`[TOURNAMENT-UI] Not enough players to create tournament: ${lobby.current_players}/4`);
        dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
        toast({
          title: "Недостаточно игроков",
          description: "Для создания турнира необходимо 4 игрока",
          variant: "destructive",
        });
        return;
      }

      try {
        console.log("[TOURNAMENT-UI] Creating tournament with retry mechanism");
        
        // Используем улучшенную функцию с повторными попытками
        const { tournamentId, created } = await createTournamentWithRetry(state.lobbyId);
        
        if (tournamentId) {
          console.log(`[TOURNAMENT-UI] Tournament successfully created: ${tournamentId}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: tournamentId });
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          
          toast({
            title: "Турнир создан",
            description: "Переход на страницу турнира...",
            variant: "default",
          });
        } else {
          throw new Error("Турнир не был создан, но ошибки не возникло");
        }
      } catch (error: any) {
        console.error("[TOURNAMENT-UI] Error in tournament creation:", error);
        
        // Переходим в режим ожидания и повторной попытки
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
        toast({
          title: "Ошибка создания турнира",
          description: "Пробуем еще раз...",
          variant: "destructive",
        });
        
        // Подождем 2 секунды
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Проверим, не создан ли турнир за это время
        const { data: updatedLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', state.lobbyId)
          .maybeSingle();
          
        if (updatedLobby?.tournament_id) {
          console.log(`[TOURNAMENT-UI] Tournament was created by another process: ${updatedLobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: updatedLobby.tournament_id });
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        } else {
          // Если турнир все еще не создан, перезапустим процесс
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
          dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
          
          // Увеличиваем задержку между попытками
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Попробуем создать турнир еще раз с небольшой задержкой
          dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
        }
      } finally {
        if (!state.tournamentId) {
          dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
        }
      }
    } catch (error: any) {
      console.error("[TOURNAMENT-UI] Fatal error in tournament creation:", error);
      
      toast({
        title: "Критическая ошибка создания турнира",
        description: error.message || "Произошла непредвиденная ошибка",
        variant: "destructive",
      });
      
      dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
      
      // Возможно, стоит отменить поиск при критической ошибке
      await handleCancelSearch();
    }
  }, [state.isCreatingTournament, state.lobbyId, state.readyPlayers, state.lobbyParticipants, state.tournamentId, dispatch, toast, handleCancelSearch]);

  return { checkTournamentCreation };
};
