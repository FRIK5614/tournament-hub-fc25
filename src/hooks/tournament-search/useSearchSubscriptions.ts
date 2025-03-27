
import { useRef, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

export type RefreshCallback = (lobbyId: string) => Promise<void>;

// Determine if we're in a production environment
const isProduction = window.location.hostname !== 'localhost' && 
                    !window.location.hostname.includes('preview--') && 
                    !window.location.hostname.includes('127.0.0.1');

export const useSearchSubscriptions = (
  isSearching: boolean,
  lobbyId: string | null,
  onDataRefresh: RefreshCallback
) => {
  const cleanupSubscriptionRef = useRef<(() => void) | null>(null);
  const channelsRef = useRef<{lobbyChannel: any, lobbyStatusChannel: any, readyPlayersChannel: any, participantStatusChannel: any}>({
    lobbyChannel: null,
    lobbyStatusChannel: null,
    readyPlayersChannel: null,
    participantStatusChannel: null
  });

  // Function to log subscription status
  const logSubscriptionStatus = useCallback((status: string, channelName: string) => {
    console.log(`[TOURNAMENT-UI] ${channelName} subscription status: ${status}`);
    
    // In production, extra logging for debugging
    if (isProduction && status !== 'SUBSCRIBED') {
      console.warn(`[TOURNAMENT-UI] ${channelName} subscription issue in production: ${status}`);
    }
  }, []);

  // Setup subscription to lobby updates and return a cleanup function
  const setupSubscriptions = useCallback((lobbyId: string) => {
    if (!lobbyId) return () => {};
    console.log(`[TOURNAMENT-UI] Setting up subscriptions for lobby ${lobbyId}`);
    
    try {
      // Create unique channel names with a timestamp and client ID to avoid conflicts
      const timestamp = Date.now();
      const clientId = Math.random().toString(36).substring(2, 10);
      
      // Channel for lobby participants
      const lobbyChannel = supabase
        .channel(`lobby_changes_${lobbyId}_${timestamp}_${clientId}`)
        .on('postgres_changes', {
          event: '*', 
          schema: 'public',
          table: 'lobby_participants',
          filter: `lobby_id=eq.${lobbyId}`
        }, (payload) => {
          console.log("[TOURNAMENT-UI] Lobby participants changed:", payload);
          onDataRefresh(lobbyId).catch(err => {
            console.error("[TOURNAMENT-UI] Error refreshing after lobby participants change:", err);
          });
        })
        .subscribe((status) => logSubscriptionStatus(status, "Lobby participants channel"));
        
      // Channel for lobby status
      const lobbyStatusChannel = supabase
        .channel(`lobby_status_changes_${lobbyId}_${timestamp}_${clientId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_lobbies',
          filter: `id=eq.${lobbyId}`
        }, (payload) => {
          console.log("[TOURNAMENT-UI] Lobby status changed:", payload);
          onDataRefresh(lobbyId).catch(err => {
            console.error("[TOURNAMENT-UI] Error refreshing after lobby status change:", err);
          });
        })
        .subscribe((status) => logSubscriptionStatus(status, "Lobby status channel"));
      
      // New channel specifically for ready players updates
      const readyPlayersChannel = supabase
        .channel(`ready_players_${lobbyId}_${timestamp}_${clientId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'lobby_participants',
          filter: `lobby_id=eq.${lobbyId} and is_ready=eq.true`
        }, (payload) => {
          if (payload.new && payload.new.is_ready !== payload.old?.is_ready) {
            console.log("[TOURNAMENT-UI] Ready player status changed:", payload.new);
            onDataRefresh(lobbyId).catch(err => {
              console.error("[TOURNAMENT-UI] Error refreshing after ready status change:", err);
            });
          }
        })
        .subscribe((status) => logSubscriptionStatus(status, "Ready players channel"));
        
      // New channel specifically for participant status updates
      const participantStatusChannel = supabase
        .channel(`participant_status_${lobbyId}_${timestamp}_${clientId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'lobby_participants',
          filter: `lobby_id=eq.${lobbyId}`
        }, (payload) => {
          if (payload.new && payload.new.status !== payload.old?.status) {
            console.log("[TOURNAMENT-UI] Participant status changed:", payload.new);
            onDataRefresh(lobbyId).catch(err => {
              console.error("[TOURNAMENT-UI] Error refreshing after participant status change:", err);
            });
          }
        })
        .subscribe((status) => logSubscriptionStatus(status, "Participant status channel"));
      
      // Store channel references
      channelsRef.current = { 
        lobbyChannel, 
        lobbyStatusChannel, 
        readyPlayersChannel,
        participantStatusChannel
      };
        
      return () => {
        console.log(`[TOURNAMENT-UI] Cleaning up subscriptions for lobby ${lobbyId}`);
        try {
          supabase.removeChannel(lobbyChannel);
          supabase.removeChannel(lobbyStatusChannel);
          supabase.removeChannel(readyPlayersChannel);
          supabase.removeChannel(participantStatusChannel);
        } catch (err) {
          console.error("[TOURNAMENT-UI] Error removing channels:", err);
        }
      };
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error setting up subscriptions:", error);
      return () => {}; // Return empty cleanup function to prevent errors
    }
  }, [onDataRefresh, logSubscriptionStatus]);

  // Helper to check subscription status
  const checkSubscriptionStatus = useCallback(() => {
    const channels = Object.values(channelsRef.current).filter(Boolean);
    
    for (const channel of channels) {
      if (channel) {
        const subscriptionStatus = channel.state;
        console.log(`[TOURNAMENT-UI] Channel ${channel.topic} status: ${subscriptionStatus}`);
        
        // If we detect a problematic state, attempt reset
        if (subscriptionStatus !== 'SUBSCRIBED') {
          console.warn(`[TOURNAMENT-UI] Detected problematic subscription state for ${channel.topic}: ${subscriptionStatus}`);
          
          // Force refresh data even if subscription is in a bad state
          if (lobbyId) {
            onDataRefresh(lobbyId).catch(err => {
              console.error("[TOURNAMENT-UI] Error in manual refresh:", err);
            });
          }
        }
      }
    }
  }, [lobbyId, onDataRefresh]);

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
      
      // Set up periodic subscription status check - more frequent in production
      const statusCheckInterval = window.setInterval(
        checkSubscriptionStatus, 
        isProduction ? 3000 : 5000
      );
      
      // Cleanup function
      return () => {
        if (cleanupSubscriptionRef.current) {
          cleanupSubscriptionRef.current();
          cleanupSubscriptionRef.current = null;
        }
        
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
      };
    }
    
    // Cleanup function when searching is disabled
    return () => {
      if (cleanupSubscriptionRef.current) {
        cleanupSubscriptionRef.current();
        cleanupSubscriptionRef.current = null;
      }
    };
  }, [isSearching, lobbyId, setupSubscriptions, onDataRefresh, checkSubscriptionStatus, isProduction]);
};
