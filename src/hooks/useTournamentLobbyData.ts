
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
          
          const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select(`
              *,
              player1:player1_id(id, username, avatar_url),
              player2:player2_id(id, username, avatar_url)
            `)
            .eq('tournament_id', tournamentId)
            .or(`player1_id.eq.${user.user.id},player2_id.eq.${user.user.id}`);
            
          if (matchesError) {
            console.error(`[TOURNAMENT-LOBBY] Error loading matches: ${matchesError.message}`);
            throw matchesError;
          }
          
          console.log(`[TOURNAMENT-LOBBY] Player matches loaded: ${matches?.length || 0}`);
          setPlayerMatches(matches || []);
        }
        
        // Get tournament standings
        console.log(`[TOURNAMENT-LOBBY] Loading standings for tournament: ${tournamentId}`);
        
        const { data: standingsData, error: standingsError } = await supabase
          .from('tournament_participants')
          .select(`
            *,
            user:user_id(id, username, avatar_url)
          `)
          .eq('tournament_id', tournamentId)
          .order('points', { ascending: false });
          
        if (standingsError) {
          console.error(`[TOURNAMENT-LOBBY] Error loading standings: ${standingsError.message}`);
          throw standingsError;
        }
        
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
    
    // Subscribe to match updates
    const matchesChannel = supabase
      .channel('tournament_matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, async () => {
        console.log(`[TOURNAMENT-LOBBY] Matches updated for tournament: ${tournamentId}`);
        
        try {
          // Обновляем матчи для текущего пользователя
          const { data: user } = await supabase.auth.getUser();
          if (user?.user) {
            const { data: matches, error: matchesError } = await supabase
              .from('matches')
              .select(`
                *,
                player1:player1_id(id, username, avatar_url),
                player2:player2_id(id, username, avatar_url)
              `)
              .eq('tournament_id', tournamentId)
              .or(`player1_id.eq.${user.user.id},player2_id.eq.${user.user.id}`);
              
            if (matchesError) {
              console.error(`[TOURNAMENT-LOBBY] Error updating matches: ${matchesError.message}`);
            } else {
              console.log(`[TOURNAMENT-LOBBY] Updated player matches: ${matches?.length || 0}`);
              setPlayerMatches(matches || []);
            }
          }
        } catch (error: any) {
          console.error(`[TOURNAMENT-LOBBY] Error in matches subscription: ${error.message}`);
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
      }, async () => {
        console.log(`[TOURNAMENT-LOBBY] Standings updated for tournament: ${tournamentId}`);
        
        try {
          const { data: standingsData, error: standingsError } = await supabase
            .from('tournament_participants')
            .select(`
              *,
              user:user_id(id, username, avatar_url)
            `)
            .eq('tournament_id', tournamentId)
            .order('points', { ascending: false });
            
          if (standingsError) {
            console.error(`[TOURNAMENT-LOBBY] Error updating standings: ${standingsError.message}`);
          } else {
            console.log(`[TOURNAMENT-LOBBY] Updated standings: ${standingsData?.length || 0} participants`);
            setStandings(standingsData || []);
          }
        } catch (error: any) {
          console.error(`[TOURNAMENT-LOBBY] Error in standings subscription: ${error.message}`);
        }
      })
      .subscribe();
      
    // Subscribe to chat messages
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
      supabase.removeChannel(chatChannel);
    };
  }, [tournamentId, toast]);

  // Найти текущий активный матч для игрока
  const getCurrentMatch = () => {
    if (!playerMatches.length) return null;
    
    // Сначала ищем матчи со статусом 'scheduled' или 'awaiting_confirmation'
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
