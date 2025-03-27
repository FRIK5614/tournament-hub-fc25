
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { searchForQuickTournament, markUserAsReady, checkAllPlayersReady } from '@/services/tournamentService';
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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch the current user's ID
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUserId(data.user.id);
      }
    };
    
    fetchUser();
  }, []);

  // Fetch lobby participants whenever the lobbyId changes
  useEffect(() => {
    if (!lobbyId) return;

    const fetchLobbyParticipants = async () => {
      try {
        // Fetch lobby data
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
        
        // If we already have a tournament ID, navigate to it
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
        
        // Enable ready check only when we have reached full player count
        const isReadyCheckActive = lobbyData.status === 'ready_check' && lobbyData.current_players === lobbyData.max_players;
        setReadyCheckActive(isReadyCheckActive);
        
        if (isReadyCheckActive && !readyCheckActive) {
          toast({
            title: "Игроки найдены!",
            description: "Подтвердите свою готовность к началу турнира.",
            variant: "default",
          });
        }
        
        // Fetch participants separately
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
          
          // Fetch profiles for all participants
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
            
          if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
          }
          
          // Combine participants with their profiles
          const participantsWithProfiles = participants.map(participant => {
            const profile = profiles?.find(p => p.id === participant.user_id);
            return {
              ...participant,
              profile: profile || { username: 'Unknown Player', avatar_url: null }
            };
          });
          
          setLobbyParticipants(participantsWithProfiles || []);
          
          // Update ready players list (truly ready players)
          const readyPlayerIds = participantsWithProfiles
            ?.filter(p => p.is_ready && p.status === 'ready')
            .map(p => p.user_id) || [];
          setReadyPlayers(readyPlayerIds);
          
          console.log("Ready players:", readyPlayerIds);
          console.log("Total players:", participantsWithProfiles.length);
          
          // If all players are ready and we have the right count, check for tournament
          if (readyPlayerIds.length === lobbyData.max_players && isReadyCheckActive) {
            checkTournamentCreation();
          }
        } else {
          setLobbyParticipants([]);
          setReadyPlayers([]);
        }
      } catch (error) {
        console.error("Error in fetchLobbyParticipants:", error);
      }
    };

    // Initial fetch
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
        const currentPlayers = payload.new.current_players;
        const maxPlayers = payload.new.max_players;
        
        // Update UI based on lobby status change
        if (newStatus === 'ready_check' && currentPlayers === maxPlayers) {
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
  }, [lobbyId, navigate, toast, readyCheckActive]);

  // Retry search if needed
  useEffect(() => {
    if (isSearching && !lobbyId && searchAttempts > 0) {
      const retryTimer = setTimeout(() => {
        handleStartSearch(true);
      }, 2000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [isSearching, lobbyId, searchAttempts]);

  // Countdown timer for ready check
  useEffect(() => {
    if (!readyCheckActive || countdownSeconds <= 0) return;
    
    const timer = setTimeout(() => {
      setCountdownSeconds(count => count - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [readyCheckActive, countdownSeconds]);

  // Handle countdown expiration
  useEffect(() => {
    if (readyCheckActive && countdownSeconds === 0) {
      handleCancelSearch();
      toast({
        title: "Время истекло",
        description: "Не все игроки подтвердили готовность. Поиск отменен.",
        variant: "destructive",
      });
    }
  }, [countdownSeconds, readyCheckActive]);

  // Function to check if tournament should be created
  const checkTournamentCreation = useCallback(async () => {
    if (!lobbyId) return;
    
    // Only check every 2 seconds to avoid too many requests
    const tournamentId = await checkAllPlayersReady(lobbyId);
    if (tournamentId && typeof tournamentId === 'string') {
      console.log("All players ready, tournament created:", tournamentId);
      
      toast({
        title: "Турнир начинается!",
        description: "Все игроки готовы. Переход к турниру...",
        variant: "default",
      });
      
      // Navigate to the tournament
      setTimeout(() => {
        navigate(`/tournaments/${tournamentId}`);
      }, 1000);
    }
  }, [lobbyId, navigate, toast]);

  // Start searching for a tournament
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

  // Cancel the search
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

  // Mark user as ready
  const handleReadyCheck = async () => {
    if (!lobbyId || isLoading) return;
    
    try {
      setIsLoading(true);
      const result = await markUserAsReady(lobbyId);
      console.log("Mark ready result:", result);
      
      // Add user to ready players list
      if (currentUserId) {
        setReadyPlayers(prev => [...prev, currentUserId]);
      }
      
      toast({
        title: "Готовность подтверждена",
        description: "Ожидание подтверждения других игроков...",
        variant: "default",
      });
      
      // Check if this was the last player and we should create the tournament
      const { data: lobbyData } = await supabase
        .from('tournament_lobbies')
        .select('max_players')
        .eq('id', lobbyId)
        .single();
        
      if (lobbyData && readyPlayers.length + 1 === lobbyData.max_players) {
        await checkTournamentCreation();
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось подтвердить готовность",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if current user is ready
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
                className={`btn-primary bg-green-600 hover:bg-green-700 ${isLoading ? 'opacity-50' : ''}`}
                onClick={handleReadyCheck}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : (
                  <Check size={18} className="mr-2" />
                )}
                Я готов
              </button>
            )}
            
            <button 
              className="btn-outline bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={handleCancelSearch}
              disabled={isLoading}
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
