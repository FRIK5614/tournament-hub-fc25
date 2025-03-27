
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getTournamentStandings, getPlayerMatches } from '@/services/tournament';

export function useTournamentLobbyData(tournamentId: string) {
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<any>(null);
  const [playerMatches, setPlayerMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTournamentData = async () => {
      try {
        console.log(`[TOURNAMENT-LOBBY] Loading tournament data for ID: ${tournamentId}`);
        
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          setUserId(user.user.id);
          console.log(`[TOURNAMENT-LOBBY] Current user ID: ${user.user.id}`);
        }
        
        // Get tournament details with expanded lobby data
        const { data, error } = await supabase
          .from('tournaments')
          .select('*, lobby:lobby_id(*)')
          .eq('id', tournamentId)
          .single();
        
        if (error) {
          console.error(`[TOURNAMENT-LOBBY] Error loading tournament: ${error.message}`);
          throw error;
        }
        
        console.log(`[TOURNAMENT-LOBBY] Tournament data loaded: ${data.title}`);
        setTournament(data);
        
        // Get player's matches with expanded player data
        if (user?.user) {
          console.log(`[TOURNAMENT-LOBBY] Loading matches for player: ${user.user.id}`);
          
          const matches = await getPlayerMatches(tournamentId, user.user.id);
          console.log(`[TOURNAMENT-LOBBY] Player matches loaded: ${matches?.length || 0}`);
          setPlayerMatches(matches || []);
        }
        
        // Get tournament standings
        console.log(`[TOURNAMENT-LOBBY] Loading standings for tournament: ${tournamentId}`);
        
        const standingsData = await getTournamentStandings(tournamentId);
        console.log(`[TOURNAMENT-LOBBY] Standings loaded: ${standingsData?.length || 0} participants`);
        setStandings(standingsData || []);
        
        setLoading(false);
      } catch (error: any) {
        console.error(`[TOURNAMENT-LOBBY] Error: ${error.message}`, error);
        toast({
          title: "Ошибка загрузки данных",
          description: error.message || "Не удалось загрузить данные турнира",
          variant: "destructive",
        });
        setLoading(false);
      }
    };
    
    fetchTournamentData();
    
    // Enable realtime updates for matches, standings and tournament data
    
    // Subscribe to match updates
    const matchesChannel = supabase
      .channel('tournament_matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, async (payload) => {
        console.log(`[TOURNAMENT-LOBBY] Matches updated for tournament: ${tournamentId}`, payload);
        
        try {
          // Update matches for current user
          const { data: user } = await supabase.auth.getUser();
          if (user?.user) {
            const matches = await getPlayerMatches(tournamentId, user.user.id);
            console.log(`[TOURNAMENT-LOBBY] Updated player matches: ${matches?.length || 0}`);
            setPlayerMatches(matches || []);
          }
        } catch (error: any) {
          console.error(`[TOURNAMENT-LOBBY] Error in matches subscription: ${error.message}`);
        }
      })
      .subscribe((status) => {
        console.log(`[TOURNAMENT-LOBBY] Matches subscription status: ${status}`);
      });
      
    // Subscribe to standings updates
    const standingsChannel = supabase
      .channel('tournament_standings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournamentId}`
      }, async (payload) => {
        console.log(`[TOURNAMENT-LOBBY] Standings updated for tournament: ${tournamentId}`, payload);
        
        try {
          const standingsData = await getTournamentStandings(tournamentId);
          console.log(`[TOURNAMENT-LOBBY] Updated standings: ${standingsData?.length || 0} participants`);
          setStandings(standingsData || []);
        } catch (error: any) {
          console.error(`[TOURNAMENT-LOBBY] Error in standings subscription: ${error.message}`);
        }
      })
      .subscribe((status) => {
        console.log(`[TOURNAMENT-LOBBY] Standings subscription status: ${status}`);
      });
      
    // Subscribe to tournament updates
    const tournamentChannel = supabase
      .channel('tournament_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`
      }, async (payload) => {
        console.log(`[TOURNAMENT-LOBBY] Tournament updated: ${tournamentId}`, payload);
        
        try {
          const { data, error } = await supabase
            .from('tournaments')
            .select('*, lobby:lobby_id(*)')
            .eq('id', tournamentId)
            .single();
            
          if (!error && data) {
            console.log(`[TOURNAMENT-LOBBY] Updated tournament data:`, data);
            setTournament(data);
          }
        } catch (error: any) {
          console.error(`[TOURNAMENT-LOBBY] Error in tournament subscription: ${error.message}`);
        }
      })
      .subscribe((status) => {
        console.log(`[TOURNAMENT-LOBBY] Tournament subscription status: ${status}`);
      });
    
    // Setup improved chat message subscription
    const chatChannel = supabase
      .channel('tournament_chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        console.log(`[TOURNAMENT-LOBBY] New chat message in tournament: ${tournamentId}`);
      })
      .subscribe();
    
    return () => {
      console.log(`[TOURNAMENT-LOBBY] Cleaning up subscriptions for tournament: ${tournamentId}`);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(standingsChannel);
      supabase.removeChannel(tournamentChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [tournamentId, toast]);

  // Find current active match for player
  const getCurrentMatch = () => {
    if (!playerMatches || playerMatches.length === 0) return null;
    
    // First look for matches with status 'scheduled' or 'awaiting_confirmation'
    const currentMatch = playerMatches.find(match => 
      match.status === 'scheduled' || match.status === 'awaiting_confirmation'
    );
    
    if (currentMatch) {
      console.log(`[TOURNAMENT-LOBBY] Current match found: ${currentMatch.id}, status: ${currentMatch.status}`);
      return currentMatch;
    } else {
      console.log(`[TOURNAMENT-LOBBY] No current match found. All matches may be completed.`);
      return null;
    }
  };

  return {
    loading,
    tournament,
    playerMatches,
    standings,
    userId,
    getCurrentMatch
  };
}
