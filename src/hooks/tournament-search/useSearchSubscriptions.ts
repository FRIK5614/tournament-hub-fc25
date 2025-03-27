
import { useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

export const useSearchSubscriptions = (
  isSearching: boolean,
  lobbyId: string | null,
  refreshLobbyData: (lobbyId: string) => Promise<void>,
  dispatch: React.Dispatch<any>,
) => {
  // Настройка real-time подписок на изменения в лобби
  useEffect(() => {
    if (!isSearching || !lobbyId) return;

    console.log(`[TOURNAMENT-UI] Setting up realtime subscriptions for lobby ${lobbyId}`);
    
    // Подписка на изменения лобби
    const lobbyChannel = supabase
      .channel(`lobby_changes_${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_lobbies',
          filter: `id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('[TOURNAMENT-UI] Lobby changed:', payload.new);
          
          // Если количество игроков изменилось, обновляем данные о участниках
          if (payload.new.current_players !== payload.old.current_players) {
            console.log('[TOURNAMENT-UI] Player count changed, refreshing participants');
            refreshLobbyData(lobbyId);
          }
          
          // Проверяем, изменился ли статус на ready_check
          if (payload.new.status === 'ready_check' && payload.old.status !== 'ready_check') {
            console.log('[TOURNAMENT-UI] Ready check activated!');
            dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
            dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 120 });  // Увеличиваем до 120 секунд (2 минуты)
            
            // Принудительно обновляем данные о участниках
            refreshLobbyData(lobbyId);
          }
          
          // Проверяем, был ли создан турнир
          if (payload.new.tournament_id && !payload.old.tournament_id) {
            console.log(`[TOURNAMENT-UI] Tournament created: ${payload.new.tournament_id}`);
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: payload.new.tournament_id });
          }
        }
      )
      .subscribe();

    // Подписка на изменения участников (как INSERT, так и UPDATE)
    const participantsChannel = supabase
      .channel(`participants_changes_${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',  // Слушаем все события (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'lobby_participants',
          filter: `lobby_id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('[TOURNAMENT-UI] Participant changed:', payload);
          // Любое изменение участников должно вызывать обновление
          refreshLobbyData(lobbyId);
        }
      )
      .subscribe();

    // Опрашиваем изменения каждые 3 секунды как запасной механизм
    const intervalId = setInterval(() => {
      console.log('[TOURNAMENT-UI] Polling for lobby data updates');
      refreshLobbyData(lobbyId);
    }, 3000);

    return () => {
      console.log(`[TOURNAMENT-UI] Cleaning up realtime subscriptions for lobby ${lobbyId}`);
      supabase.removeChannel(lobbyChannel);
      supabase.removeChannel(participantsChannel);
      clearInterval(intervalId);
    };
  }, [isSearching, lobbyId, refreshLobbyData, dispatch]);
};
