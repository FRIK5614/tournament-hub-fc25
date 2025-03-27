
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getLobbyStatus, getPlayerMatches, getTournamentStandings } from '@/services/tournamentService';
import { useToast } from "@/hooks/use-toast";
import TournamentChat from './TournamentChat';
import TournamentStandings from './TournamentStandings';
import MatchCard from './MatchCard';
import { Loader2 } from 'lucide-react';

interface TournamentLobbyProps {
  tournamentId: string;
}

const TournamentLobby = ({ tournamentId }: TournamentLobbyProps) => {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const currentMatch = getCurrentMatch();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column - Tournament info and chat */}
      <div className="lg:col-span-1">
        <TournamentChat tournamentId={tournamentId} />
      </div>
      
      {/* Right column - Main content area */}
      <div className="lg:col-span-2">
        <div className="glass-card p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">{tournament?.title || 'Быстрый турнир'}</h2>
          
          {tournament?.status === 'active' && (
            <div className="bg-fc-accent/20 border border-fc-accent rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-2">Информация о турнире</h3>
              <p className="text-gray-300">
                Турнир активен. Каждый участник играет с каждым. 
                За победу начисляется 3 очка, за ничью - 1 очко.
                У вас есть 20 минут на проведение каждого матча.
              </p>
            </div>
          )}
          
          <Tabs defaultValue="current-match">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="current-match" className="flex-1">Текущий матч</TabsTrigger>
              <TabsTrigger value="standings" className="flex-1">Таблица</TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1">Расписание</TabsTrigger>
            </TabsList>
            
            <TabsContent value="current-match">
              {currentMatch ? (
                <MatchCard match={currentMatch} userId={userId} />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">
                    {playerMatches.length === 0 
                      ? "У вас нет запланированных матчей." 
                      : "Все ваши матчи завершены."}
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="standings">
              <TournamentStandings standings={standings} />
            </TabsContent>
            
            <TabsContent value="schedule">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-2">Ваши матчи</h3>
                
                {playerMatches.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">У вас нет запланированных матчей.</p>
                ) : (
                  playerMatches.map((match) => (
                    <div 
                      key={match.id} 
                      className={`glass-card p-4 ${
                        match.status === 'completed' 
                          ? 'opacity-60' 
                          : 'border-fc-accent'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="font-medium">{match.player1?.username || 'Игрок 1'}</span>
                          {match.status === 'completed' && (
                            <span className="mx-2 font-bold">{match.player1_score}</span>
                          )}
                        </div>
                        
                        <div className="mx-2 text-xs">
                          {match.status === 'scheduled' && 'Запланирован'}
                          {match.status === 'awaiting_confirmation' && 'Ожидает подтверждения'}
                          {match.status === 'completed' && 'Завершен'}
                        </div>
                        
                        <div className="flex items-center">
                          {match.status === 'completed' && (
                            <span className="mx-2 font-bold">{match.player2_score}</span>
                          )}
                          <span className="font-medium">{match.player2?.username || 'Игрок 2'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TournamentLobby;
