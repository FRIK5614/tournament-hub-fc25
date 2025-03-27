
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { searchForQuickTournament, markUserAsReady } from '@/services/tournamentService';
import { Loader2, Users, Check, X } from 'lucide-react';

const QuickTournamentSearch = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [readyCheckActive, setReadyCheckActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(30);
  const [lobbyParticipants, setLobbyParticipants] = useState<any[]>([]);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [searchAttempts, setSearchAttempts] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUserId(data.user.id);
      }
    };
    
    fetchUser();
  }, []);

  useEffect(() => {
    if (!lobbyId) return;

    const fetchLobbyParticipants = async () => {
      try {
        const { data: lobbyData, error: lobbyError } = await supabase
          .from('tournament_lobbies')
          .select('current_players, status, max_players, tournament_id')
          .eq('id', lobbyId)
          .single();
        
        if (lobbyError) {
          console.error("Error fetching lobby:", lobbyError);
          return;
        }
        
        console.log("Lobby data:", lobbyData);
        
        // If tournament is created, navigate to it
        if (lobbyData.tournament_id) {
          console.log("Tournament ID found, navigating to:", lobbyData.tournament_id);
          
          toast({
            title: "Турнир начинается!",
            description: "Все игроки готовы. Переход к турниру...",
            variant: "default",
          });
          
          // Short delay to ensure all clients receive the update
          setTimeout(() => {
            navigate(`/tournaments/${lobbyData.tournament_id}`);
          }, 1000);
          return;
        }
        
        setReadyCheckActive(lobbyData.status === 'ready_check');
        
        // Fetch participants separately to get all necessary information
        const { data: participants, error: participantsError } = await supabase
          .from('lobby_participants')
          .select('id, user_id, lobby_id, is_ready, status')
          .eq('lobby_id', lobbyId)
          .or('status.eq.searching,status.eq.ready');
        
        if (participantsError) {
          console.error("Error fetching lobby participants:", participantsError);
          return;
        }
        
        console.log("Lobby participants:", participants);
        
        if (participants && participants.length > 0) {
          const userIds = participants.map(p => p.user_id);
          
          // Fetch profiles separately
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
            
          if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
          }
          
          console.log("Profiles data:", profiles);
          
          // Combine participants with their profiles
          const participantsWithProfiles = participants.map(participant => {
            const profile = profiles?.find(p => p.id === participant.user_id);
            return {
              ...participant,
              profile: profile || { username: 'Unknown Player', avatar_url: null }
            };
          });
          
          console.log("Lobby participants with profiles:", participantsWithProfiles);
          setLobbyParticipants(participantsWithProfiles || []);
          
          // Update ready players list
          const readyPlayerIds = participantsWithProfiles
            ?.filter(p => p.is_ready)
            .map(p => p.user_id) || [];
          setReadyPlayers(readyPlayerIds);
          
          console.log("Ready players:", readyPlayerIds);
          console.log("Total players:", participantsWithProfiles.length);
        } else {
          setLobbyParticipants([]);
          setReadyPlayers([]);
        }
      } catch (error) {
        console.error("Error in fetchLobbyParticipants:", error);
      }
    };

    // Fetch initially
    fetchLobbyParticipants();

    // Subscribe to changes in lobby participants
    const lobbyChannel = supabase
      .channel('lobby_changes')
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'lobby_participants',
        filter: `lobby_id=eq.${lobbyId}`
      }, () => {
        console.log("Lobby participants changed, refreshing data");
        fetchLobbyParticipants();
      })
      .subscribe();
      
    // Subscribe to changes in lobby status
    const lobbyStatusChannel = supabase
      .channel('lobby_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_lobbies',
        filter: `id=eq.${lobbyId}`
      }, (payload: any) => {
        console.log("Lobby status changed:", payload);
        const newStatus = payload.new.status;
        const tournamentId = payload.new.tournament_id;
        
        if (newStatus === 'ready_check') {
          setReadyCheckActive(true);
          setCountdownSeconds(30); // Reset countdown for ready check
          
          toast({
            title: "Игроки найдены!",
            description: "Подтвердите свою готовность к началу турнира.",
            variant: "default",
          });
        } else if (newStatus === 'active' && tournamentId) {
          toast({
            title: "Турнир начинается!",
            description: "Все игроки готовы. Переход к турниру...",
            variant: "default",
          });
          
          setTimeout(() => {
            navigate(`/tournaments/${tournamentId}`);
          }, 1000);
        }
        
        fetchLobbyParticipants();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(lobbyChannel);
      supabase.removeChannel(lobbyStatusChannel);
    };
  }, [lobbyId, navigate, toast]);

  useEffect(() => {
    if (isSearching && !lobbyId && searchAttempts > 0) {
      const retryTimer = setTimeout(() => {
        handleStartSearch(true);
      }, 2000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [isSearching, lobbyId, searchAttempts]);

  useEffect(() => {
    if (!readyCheckActive || countdownSeconds <= 0) return;
    
    const timer = setTimeout(() => {
      setCountdownSeconds(count => count - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [readyCheckActive, countdownSeconds]);

  useEffect(() => {
    if (readyCheckActive && countdownSeconds === 0) {
      handleCancelSearch();
      toast({
        title: "Время истекло",
        description: "Не все игроки подтвердили готовность. Поиск отменен.",
        variant: "destructive",
      });
    }
  }, [countdownSeconds, readyCheckActive, toast]);

  const handleStartSearch = async (isRetry = false) => {
    try {
      setIsSearching(true);
      
      if (!isRetry) {
        toast({
          title: "Поиск турнира",
          description: "Поиск быстрого турнира начат. Ожидание других игроков...",
          variant: "default",
        });
      }
      
      const newLobbyId = await searchForQuickTournament();
      setLobbyId(newLobbyId);
      console.log("Joined lobby:", newLobbyId);
      
      setSearchAttempts(0);
    } catch (error: any) {
      console.error("Error searching for tournament:", error);
      
      if (searchAttempts < 3) {
        toast({
          title: "Повторная попытка поиска",
          description: "Возникла проблема при поиске. Пробуем еще раз...",
          variant: "default",
        });
      }
      
      setSearchAttempts(prev => prev + 1);
    }
  };

  const handleCancelSearch = async () => {
    if (!lobbyId) {
      setIsSearching(false);
      setSearchAttempts(0);
      return;
    }
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        await supabase
          .from('lobby_participants')
          .update({ status: 'left' })
          .eq('lobby_id', lobbyId)
          .eq('user_id', user.user.id);
      }
      
      setIsSearching(false);
      setLobbyId(null);
      setReadyCheckActive(false);
      setSearchAttempts(0);
      
      toast({
        title: "Поиск отменен",
        description: "Вы вышли из поиска турнира",
        variant: "default",
      });
    } catch (error) {
      console.error("Error canceling search:", error);
    }
  };

  const handleReadyCheck = async () => {
    if (!lobbyId) return;
    
    try {
      const result = await markUserAsReady(lobbyId);
      console.log("Mark ready result:", result);
      
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        setReadyPlayers(prev => [...prev, user.user.id]);
      }
      
      toast({
        title: "Готовность подтверждена",
        description: "Ожидание подтверждения других игроков...",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось подтвердить готовность",
        variant: "destructive",
      });
    }
  };

  const isUserReady = () => {
    return currentUserId ? readyPlayers.includes(currentUserId) : false;
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-xl font-semibold mb-4">Быстрый турнир</h3>
      
      {!isSearching && (
        <div className="text-center">
          <p className="text-gray-300 mb-4">
            Участвуйте в быстрых турнирах на 4 игрока, где каждый играет с каждым.
            Победы повышают ваш рейтинг для участия в долгосрочных турнирах.
          </p>
          
          <button 
            className="btn-primary"
            onClick={() => handleStartSearch()}
          >
            Найти турнир
          </button>
        </div>
      )}
      
      {isSearching && !readyCheckActive && (
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="animate-spin mr-2" size={20} />
            <span>Поиск игроков {lobbyParticipants.length}/4...</span>
          </div>
          
          {lobbyParticipants.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Участники:</h4>
              <div className="flex justify-center gap-2">
                {lobbyParticipants.map((participant, idx) => (
                  <div key={idx} className="glass-card p-2 text-xs">
                    {participant.profile?.username || 'Игрок'}
                  </div>
                ))}
                {Array(4 - lobbyParticipants.length).fill(0).map((_, idx) => (
                  <div key={`empty-${idx}`} className="glass-card bg-opacity-30 p-2 text-xs text-gray-500">
                    Ожидание...
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button 
            className="btn-outline bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            onClick={handleCancelSearch}
          >
            Отменить поиск
          </button>
        </div>
      )}
      
      {readyCheckActive && (
        <div className="text-center">
          <h4 className="text-lg font-medium mb-2">Все игроки найдены!</h4>
          <p className="text-gray-300 mb-2">Подтвердите готовность начать турнир</p>
          
          <div className="flex justify-center mb-4">
            <div className="glass-card bg-yellow-500/20 border-yellow-500 px-3 py-1 rounded-full text-sm">
              {countdownSeconds} сек.
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            {lobbyParticipants.map((participant, idx) => (
              <div 
                key={idx} 
                className={`glass-card p-3 flex items-center justify-between ${
                  readyPlayers.includes(participant.user_id) 
                    ? 'border-green-500' 
                    : 'border-gray-500'
                }`}
              >
                <span>{participant.profile?.username || 'Игрок'}</span>
                {readyPlayers.includes(participant.user_id) ? (
                  <Check className="text-green-500" size={18} />
                ) : (
                  <Loader2 className="animate-spin text-yellow-500" size={18} />
                )}
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 justify-center">
            {!isUserReady() && (
              <button 
                className="btn-primary bg-green-600 hover:bg-green-700"
                onClick={handleReadyCheck}
              >
                <Check size={18} className="mr-2" />
                Я готов
              </button>
            )}
            
            <button 
              className="btn-outline bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={handleCancelSearch}
            >
              <X size={18} className="mr-2" />
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickTournamentSearch;
