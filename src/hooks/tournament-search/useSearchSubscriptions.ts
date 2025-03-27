
import { useRef, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { fetchLobbyStatus, fetchLobbyParticipants } from './utils';

export type RefreshCallback = (lobbyId: string) => Promise<void>;

export const useSearchSubscriptions = (
  isSearching: boolean,
  lobbyId: string | null,
  onDataRefresh: RefreshCallback
) => {
  const cleanupSubscriptionRef = useRef<(() => void) | null>(null);

  // Setup subscription to lobby updates and return a cleanup function
  const setupSubscriptions = useCallback((lobbyId: string) => {
    if (!lobbyId) return () => {};
    console.log(`[TOURNAMENT-UI] Setting up subscriptions for lobby ${lobbyId}`);
    
    try {
      // Create a unique channel name with a timestamp to avoid conflicts
      const timestamp = Date.now();
      const clientId = Math.random().toString(36).substring(2, 10);
      
      const lobbyChannel = supabase
        .channel(`lobby_changes_${lobbyId}_${timestamp}_${clientId}`)
        .on('postgres_changes', {
          event: '*', 
          schema: 'public',
          table: 'lobby_participants',
          filter: `lobby_id=eq.${lobbyId}`
        }, (payload) => {
          console.log("[TOURNAMENT-UI] Lobby participants changed:", payload);
          onDataRefresh(lobbyId);
        })
        .subscribe((status) => {
          console.log(`[TOURNAMENT-UI] Lobby channel subscription status: ${status}`);
        });
        
      const lobbyStatusChannel = supabase
        .channel(`lobby_status_changes_${lobbyId}_${timestamp}_${clientId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_lobbies',
          filter: `id=eq.${lobbyId}`
        }, (payload) => {
          console.log("[TOURNAMENT-UI] Lobby status changed:", payload);
          onDataRefresh(lobbyId);
        })
        .subscribe((status) => {
          console.log(`[TOURNAMENT-UI] Lobby status channel subscription status: ${status}`);
        });
        
      return () => {
        console.log(`[TOURNAMENT-UI] Cleaning up subscriptions for lobby ${lobbyId}`);
        supabase.removeChannel(lobbyChannel);
        supabase.removeChannel(lobbyStatusChannel);
      };
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error setting up subscriptions:", error);
      return () => {}; // Return empty cleanup function to prevent errors
    }
  }, [onDataRefresh]);

  // Effect to manage subscriptions
  useEffect(() => {
    if (isSearching && lobbyId) {
      // Clean up any existing subscriptions
      if (cleanupSubscriptionRef.current) {
        cleanupSubscriptionRef.current();
        cleanupSubscriptionRef.current = null;
      }
      
      // Setup new subscriptions
      cleanupSubscriptionRef.current = setupSubscriptions(lobbyId);
      
      // Additional safeguard: refresh data immediately to ensure we have initial data
      onDataRefresh(lobbyId).catch(err => {
        console.error("[TOURNAMENT-UI] Error in initial subscription data refresh:", err);
      });
    }
    
    // Cleanup function
    return () => {
      if (cleanupSubscriptionRef.current) {
        cleanupSubscriptionRef.current();
        cleanupSubscriptionRef.current = null;
      }
    };
  }, [isSearching, lobbyId, setupSubscriptions, onDataRefresh]);
};
