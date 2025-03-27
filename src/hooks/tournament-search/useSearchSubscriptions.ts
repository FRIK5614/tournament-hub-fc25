
import { useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { TournamentSearchAction } from './reducer';

export const useSearchSubscriptions = (
  isSearching: boolean,
  lobbyId: string | null,
  refreshLobbyData: (lobbyId: string) => Promise<void>,
  dispatch: React.Dispatch<TournamentSearchAction>
) => {
  // Подписка на изменения статуса лобби
  useEffect(() => {
    if (!isSearching || !lobbyId) return;
    
    console.log("[TOURNAMENT-UI] Setting up lobby subscriptions for", lobbyId);
    
    // Подписка на изменения в лобби
    const lobbyChannel = supabase
      .channel(`lobby_updates:${lobbyId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_lobbies',
        filter: `id=eq.${lobbyId}`
      }, async (payload) => {
        console.log("[TOURNAMENT-UI] Lobby update received:", payload);
        
        const newStatus = payload.new.status;
        const oldStatus = payload.old.status;
        
        // Если статус изменился с ready_check на waiting, это значит кто-то вышел
        if (oldStatus === 'ready_check' && newStatus === 'waiting') {
          console.log("[TOURNAMENT-UI] Lobby reset from ready_check to waiting");
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: false });
          dispatch({ type: 'SET_READY_PLAYERS', payload: [] });
        }
        
        // Если лобби перешло в ready_check, активируем таймер
        if (newStatus === 'ready_check' && oldStatus !== 'ready_check') {
          console.log("[TOURNAMENT-UI] Lobby entered ready_check state");
          dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
          dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 120 });
        }
        
        // Если у лобби появился tournament_id
        if (payload.new.tournament_id && !payload.old.tournament_id) {
          console.log(`[TOURNAMENT-UI] Tournament was created: ${payload.new.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: payload.new.tournament_id });
        }
        
        // Обновляем данные лобби
        await refreshLobbyData(lobbyId);
      })
      .subscribe();
    
    // Подписка на изменения в участниках лобби
    const participantsChannel = supabase
      .channel(`lobby_participants:${lobbyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobby_participants',
        filter: `lobby_id=eq.${lobbyId}`
      }, async (payload) => {
        console.log("[TOURNAMENT-UI] Participants update received:", payload);
        
        // Обновляем данные лобби
        await refreshLobbyData(lobbyId);
        
        // Специальная обработка для выхода игрока
        if (payload.eventType === 'UPDATE' && payload.new.status === 'left' && payload.old.status !== 'left') {
          console.log("[TOURNAMENT-UI] Player left the lobby");
          
          // Можно добавить дополнительные уведомления для пользователя
          if (payload.new.status === 'left') {
            console.log("[TOURNAMENT-UI] A player has left the lobby");
          }
        }
      })
      .subscribe();
    
    return () => {
      console.log("[TOURNAMENT-UI] Cleaning up lobby subscriptions");
      supabase.removeChannel(lobbyChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [isSearching, lobbyId, refreshLobbyData, dispatch]);
};
