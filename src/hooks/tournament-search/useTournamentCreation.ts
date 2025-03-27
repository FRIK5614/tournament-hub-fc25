
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
  
  // Добавляем флаг для отслеживания количества попыток создания турнира
  const MAX_CREATION_ATTEMPTS = 3;

  const checkTournamentCreation = useCallback(async (attempt = 0) => {
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

      console.log(`[TOURNAMENT-UI] Initiating tournament creation (attempt ${attempt + 1}/${MAX_CREATION_ATTEMPTS})`);
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
        
        if (attempt < MAX_CREATION_ATTEMPTS - 1) {
          // Пробуем еще раз с задержкой
          console.log(`[TOURNAMENT-UI] Retrying tournament creation in 2 seconds...`);
          
          setTimeout(() => {
            checkTournamentCreation(attempt + 1);
          }, 2000);
        } else {
          console.log(`[TOURNAMENT-UI] Max creation attempts (${MAX_CREATION_ATTEMPTS}) reached. Giving up.`);
          
          toast({
            title: "Ошибка создания турнира",
            description: "Не удалось создать турнир из-за недостаточного количества игроков",
            variant: "destructive",
          });
          
          await handleCancelSearch();
        }
        
        return;
      }

      // Создаем турнир
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'creating' });
      
      try {
        console.log("[TOURNAMENT-UI] Creating tournament for lobby:", state.lobbyId);
        const result = await createTournamentWithRetry(state.lobbyId);
        
        if (result.created) { // This was checking result.success, but the object has created instead
          console.log(`[TOURNAMENT-UI] Tournament created successfully with ID: ${result.tournamentId}`);
          
          // Double-check if the lobby was properly updated with the tournament_id
          const { data: updatedLobby } = await supabase
            .from('tournament_lobbies')
            .select('tournament_id')
            .eq('id', state.lobbyId)
            .single();
            
          if (updatedLobby?.tournament_id) {
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: updatedLobby.tournament_id });
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
            
            toast({
              title: "Турнир создан!",
              description: "Подготовка к началу турнира...",
              variant: "default",
            });
          } else if (result.tournamentId) {
            // Если ID турнира есть в ответе, но не обновился в лобби, обновляем лобби вручную
            console.log(`[TOURNAMENT-UI] Manually updating lobby with tournament ID: ${result.tournamentId}`);
            
            await supabase
              .from('tournament_lobbies')
              .update({ 
                tournament_id: result.tournamentId,
                status: 'active',
                started_at: new Date().toISOString()
              })
              .eq('id', state.lobbyId);
              
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: result.tournamentId });
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          }
        } else {
          throw new Error("Не удалось создать турнир на сервере");
        }
      } catch (error: any) {
        console.error("[TOURNAMENT-UI] Error creating tournament:", error);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
        
        // Проверяем турнир после ошибки, возможно он все же был создан
        const { data: checkLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', state.lobbyId)
          .maybeSingle();
          
        if (checkLobby?.tournament_id) {
          console.log(`[TOURNAMENT-UI] Found tournament ID after error: ${checkLobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: checkLobby.tournament_id });
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          return;
        }
        
        // Если это не последняя попытка, пробуем создать турнир еще раз
        if (attempt < MAX_CREATION_ATTEMPTS - 1) {
          console.log(`[TOURNAMENT-UI] Retrying tournament creation in 3 seconds (attempt ${attempt + 1}/${MAX_CREATION_ATTEMPTS})`);
          
          setTimeout(() => {
            checkTournamentCreation(attempt + 1);
          }, 3000);
        } else {
          // Максимальное количество попыток исчерпано
          console.log(`[TOURNAMENT-UI] Max creation attempts (${MAX_CREATION_ATTEMPTS}) reached. Giving up.`);
          
          toast({
            title: "Ошибка создания турнира",
            description: "Не удалось создать турнир после нескольких попыток. Попробуйте снова позже.",
            variant: "destructive",
          });
          
          dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
          await handleCancelSearch();
        }
      }
    } catch (error: any) {
      console.error("[TOURNAMENT-UI] Error in checkTournamentCreation:", error);
      
      dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
      
      toast({
        title: "Ошибка создания турнира",
        description: error.message || "Произошла ошибка при проверке создания турнира",
        variant: "destructive",
      });
      
      // Если не последняя попытка, повторяем еще раз
      if (attempt < MAX_CREATION_ATTEMPTS - 1) {
        console.log(`[TOURNAMENT-UI] Retrying after error in 3 seconds (attempt ${attempt + 1}/${MAX_CREATION_ATTEMPTS})`);
        
        setTimeout(() => {
          checkTournamentCreation(attempt + 1);
        }, 3000);
      } else {
        await handleCancelSearch();
      }
    }
  }, [
    state.isCreatingTournament, 
    state.lobbyId, 
    state.readyPlayers.length, 
    state.lobbyParticipants.length,
    toast,
    handleCancelSearch
  ]);

  return { checkTournamentCreation };
};
