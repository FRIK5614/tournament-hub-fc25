
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { getLobbyStatus, getPlayerMatches, getTournamentStandings } from '@/services/tournament';
import { useToast } from "@/hooks/use-toast";

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
        
        // Get tournament details
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
        
        // Get player's matches
        if (user?.user) {
          console.log(`[TOURNAMENT-LOBBY] Loading matches for player: ${user.user.id}`);
          const matches = await getPlayerMatches(tournamentId, user.user.id);
          console.log(`[TOURNAMENT-LOBBY] Player matches loaded: ${matches.length}`);
          setPlayerMatches(matches);
        }
        
        // Get tournament standings
        console.log(`[TOURNAMENT-LOBBY] Loading standings for tournament: ${tournamentId}`);
        const standingsData = await getTournamentStandings(tournamentId);
        console.log(`[TOURNAMENT-LOBBY] Standings loaded: ${standingsData.length} participants`);
        setStandings(standingsData);
        
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
    
    // Subscribe to match updates
    const matchesChannel = supabase
      .channel('tournament_matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        console.log(`[TOURNAMENT-LOBBY] Matches updated for tournament: ${tournamentId}`);
        if (userId) {
          getPlayerMatches(tournamentId, userId).then(matches => {
            console.log(`[TOURNAMENT-LOBBY] Updated player matches: ${matches.length}`);
            setPlayerMatches(matches);
          });
        }
      })
      .subscribe();
      
    // Subscribe to standings updates
    const standingsChannel = supabase
      .channel('tournament_standings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        console.log(`[TOURNAMENT-LOBBY] Standings updated for tournament: ${tournamentId}`);
        getTournamentStandings(tournamentId).then(standings => {
          console.log(`[TOURNAMENT-LOBBY] Updated standings: ${standings.length} participants`);
          setStandings(standings);
        });
      })
      .subscribe();
      
    return () => {
      console.log(`[TOURNAMENT-LOBBY] Cleaning up subscriptions for tournament: ${tournamentId}`);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(standingsChannel);
    };
  }, [tournamentId, toast, userId]);

  const getCurrentMatch = () => {
    if (!playerMatches.length) return null;
    
    // Find a match that is scheduled or awaiting confirmation
    const currentMatch = playerMatches.find(match => 
      match.status === 'scheduled' || match.status === 'awaiting_confirmation'
    );
    
    if (currentMatch) {
      console.log(`[TOURNAMENT-LOBBY] Current match found: ${currentMatch.id}, status: ${currentMatch.status}`);
    } else {
      console.log(`[TOURNAMENT-LOBBY] No current match found. All matches may be completed.`);
    }
    
    return currentMatch;
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
