
import { useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

export const useSearchSubscriptions = (
  isSearching: boolean,
  lobbyId: string | null,
  refreshLobbyData: (lobbyId: string) => Promise<void>,
  dispatch: React.Dispatch<any>,
) => {
  // Set up real-time subscriptions for lobby changes
  useEffect(() => {
    if (!isSearching || !lobbyId) return;

    console.log(`[TOURNAMENT-UI] Setting up realtime subscriptions for lobby ${lobbyId}`);
    
    // Subscribe to lobby changes
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
          
          // If player count changed, refresh participant data
          if (payload.new.current_players !== payload.old.current_players) {
            console.log('[TOURNAMENT-UI] Player count changed, refreshing participants');
            refreshLobbyData(lobbyId);
          }
          
          // Check if status changed to ready_check
          if (payload.new.status === 'ready_check' && payload.old.status !== 'ready_check') {
            console.log('[TOURNAMENT-UI] Ready check activated!');
            dispatch({ type: 'SET_READY_CHECK_ACTIVE', payload: true });
            dispatch({ type: 'SET_COUNTDOWN_SECONDS', payload: 30 });
            
            // Force refresh participants data
            refreshLobbyData(lobbyId);
          }
          
          // Check if a tournament was created
          if (payload.new.tournament_id && !payload.old.tournament_id) {
            console.log(`[TOURNAMENT-UI] Tournament created: ${payload.new.tournament_id}`);
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: payload.new.tournament_id });
          }
        }
      )
      .subscribe();

    // Subscribe to participant changes (both INSERT and UPDATE)
    const participantsChannel = supabase
      .channel(`participants_changes_${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',  // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'lobby_participants',
          filter: `lobby_id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('[TOURNAMENT-UI] Participant changed:', payload);
          // Any change to participants should trigger a refresh
          refreshLobbyData(lobbyId);
        }
      )
      .subscribe();

    // Poll for changes every 3 seconds as a backup mechanism
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
