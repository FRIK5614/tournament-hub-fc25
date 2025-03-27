import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { searchForQuickTournament, markUserAsReady, checkAllPlayersReady, leaveQuickTournament } from '@/services/tournamentService';
import { Loader2, Users, Check, X, AlertTriangle } from 'lucide-react';

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
  const [isCreatingTournament, setIsCreatingTournament] = useState(false);
  const [tournamentCreationStatus, setTournamentCreationStatus] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUserId(data.user.id);
        console.log(`[TOURNAMENT-UI] Current user ID: ${data.user.id}`);
      }
    };
    
    fetchUser();
  }, []);

  const checkTournamentCreation = useCallback(async () => {
    if (!lobbyId || isCreatingTournament) return;
    
    console.log(`[TOURNAMENT-UI] Checking tournament creation for lobby ${lobbyId}`);
    
    try {
      setIsCreatingTournament(true);
      setTournamentCreationStatus('checking');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await checkAllPlayersReady(lobbyId);
      
      if (result.allReady && result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players ready, tournament created: ${result.tournamentId}`);
        setTournamentCreationStatus('created');
        
        toast({
          title: "Турнир начинается!",
          description: "Все игроки готовы. Переход к турниру...",
          variant: "default",
        });
        
        setTimeout(() => {
          navigate(`/tournaments/${result.tournamentId}`);
        }, 1000);
      } else if (result.allReady && !result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players are ready but tournament creation failed`);
        setTournamentCreationStatus('failed');
        
        toast({
          title: "Ошибка создания турнира",
          description: "Все игроки готовы, но не удалось создать турнир. Попробуйте снова.",
          variant: "destructive",
        });
        
        setTimeout(() => {
          handleCancelSearch();
        }, 5000);
      } else {
        setTournamentCreationStatus('waiting');
      }
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error checking tournament creation:", error);
      setTournamentCreationStatus('error');
      
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при создании турнира. Попробуйте снова.",
        variant: "destructive",
      });
      
      setTimeout(() => {
        handleCancelSearch();
      }, 5000);
    } finally {
      setIsCreatingTournament(false);
    }
  }, [lobbyId, navigate, toast, isCreatingTournament, handleCancelSearch]);

  useEffect(() => {
    if (!lobbyId) return;

    const fetchLobbyParticipants = async () => {
      try {
        console.log(`[TOURNAMENT-UI] Fetching participants for lobby ${lobbyId}`);
        
        const { data: lobbyData, error: lobbyError } = await supabase
          .from('tournament_lobbies')
          .select('id, current_players, status, max_players, tournament_id')
          .eq('id', lobbyId)
          .single();
        
        if (lobbyError) {
          console.error("[TOURNAMENT-UI] Error fetching lobby:", lobbyError);
          return;
        }
        
        console.log(`[TOURNAMENT-UI] Lobby data: status=${lobbyData.status}, players=${lobbyData.current_players}/${lobbyData.max_players}, tournament=${lobbyData.tournament_id || 'none'}`);
        
        if (lobbyData.tournament_id) {
          console.log(`[TOURNAMENT-UI] Tournament ID found, navigating to: ${lobbyData.tournament_id}`);
          
          toast({
            title: "Турнир начинается!",
            description: "Все игроки готовы. Переход к турниру...",
            variant: "default",
          });
          
          setTimeout(() => {
            navigate(`/tournaments/${lobbyData.tournament_id}`);
          }, 1000);
          return;
        }
        
        const { data: participants, error: participantsError } = await supabase
          .from('lobby_participants')
          .select('id, user_id, lobby_id, is_ready, status')
          .eq('lobby_id', lobbyId)
          .in('status', ['searching', 'ready']);
        
        if (participantsError) {
          console.error("[TOURNAMENT-UI] Error fetching lobby participants:", participantsError);
          return;
        }
        
        const actualParticipants = participants || [];
        console.log(`[TOURNAMENT-UI] Found ${actualParticipants.length} active participants in lobby ${lobbyId}`);
        
        const activePlayers = actualParticipants.length;
        const isReadyCheckActive = lobbyData.status === 'ready_check' && 
                                 activePlayers === lobbyData.max_players;
        
        setReadyCheckActive(isReadyCheckActive);
        
        if (isReadyCheckActive && !readyCheckActive && activePlayers === 4) {
          toast({
            title: "Игроки найдены!",
            description: "Подтвердите свою готовность к началу турнира.",
            variant: "default",
          });
        }
        
        if (actualParticipants.length > 0) {
          actualParticipants.forEach(p => {
            console.log(`[TOURNAMENT-UI] Participant in ${lobbyId}: userId=${p.user_id}, isReady=${p.is_ready}, status=${p.status}`);
          });
          
          const userIds = actualParticipants.map(p => p.user_id);
          
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
            
          if (profilesError) {
            console.error("[TOURNAMENT-UI] Error fetching profiles:", profilesError);
          }
          
          const participantsWithProfiles = actualParticipants.map(participant => {
            const profile = profiles?.find(p => p.id === participant.user_id);
            return {
              ...participant,
              profile: profile || { username: 'Unknown Player', avatar_url: null }
            };
          });
          
          setLobbyParticipants(participantsWithProfiles);
          
          const readyPlayerIds = participantsWithProfiles
            .filter(p => p.is_ready && p.status === 'ready')
            .map(p => p.user_id) || [];
          setReadyPlayers(readyPlayerIds);
          
          console.log(`[TOURNAMENT-UI] Ready players: ${readyPlayerIds.length}/${participantsWithProfiles.length}`);
          console.log(`[TOURNAMENT-UI] Ready player IDs: `, readyPlayerIds);
          
          if (readyPlayerIds.length === 4 && 
              participantsWithProfiles.length === 4 && 
              isReadyCheckActive && 
              !isCreatingTournament) {
            console.log(`[TOURNAMENT-UI] All 4 players are ready. Triggering tournament creation check`);
            checkTournamentCreation();
          }
        } else {
          setLobbyParticipants([]);
          setReadyPlayers([]);
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
      }
    };

    fetchLobbyParticipants();

    const lobbyChannel = supabase
      .channel('lobby_changes')
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'lobby_participants',
        filter: `lobby_id=eq.${lobbyId}`
      }, () => {
        console.log("[TOURNAMENT-UI] Lobby participants changed, refreshing data");
        fetchLobbyParticipants();
      })
      .subscribe();
      
    const lobbyStatusChannel = supabase
      .channel('lobby_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_lobbies',
        filter: `id=eq.${lobbyId}`
      }, (payload: any) => {
        console.log("[TOURNAMENT-UI] Lobby status changed:", payload);
        const newStatus = payload.new.status;
        const tournamentId = payload.new.tournament_id;
        const currentPlayers = payload.new.current_players;
        const maxPlayers = payload.new.max_players;
        
        if (newStatus === 'ready_check' && currentPlayers === maxPlayers) {
          setReadyCheckActive(true);
          setCountdownSeconds(30);
          
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
  }, [lobbyId, navigate, toast, readyCheckActive, checkTournamentCreation, isCreatingTournament]);

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
      console.log(`[TOURNAMENT-UI] Starting tournament search${isRetry ? ' (retry)' : ''}`);
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
      console.log(`[TOURNAMENT-UI] Joined lobby: ${newLobbyId}`);
      
      setSearchAttempts(0);
    } catch (error: any) {
      console.error("[TOURNAMENT-UI] Error searching for tournament:", error);
      
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
      console.log(`[TOURNAMENT-UI] Cancelling search for lobby ${lobbyId}`);
      
      if (currentUserId) {
        await leaveQuickTournament(lobbyId);
        console.log(`[TOURNAMENT-UI] User ${currentUserId} left lobby ${lobbyId}`);
      }
      
      setIsSearching(false);
      setLobbyId(null);
      setReadyCheckActive(false);
      setSearchAttempts(0);
      setTournamentCreationStatus('');
      
      toast({
        title: "Поиск отменен",
        description: "Вы вышли из поиска турнира",
        variant: "default",
      });
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error canceling search:", error);
    }
  };

  const handleReadyCheck = async () => {
    if (!lobbyId || isLoading) return;
    
    try {
      console.log(`[TOURNAMENT-UI] Marking user as ready in lobby ${lobbyId}`);
      setIsLoading(true);
      const result = await markUserAsReady(lobbyId);
      console.log(`[TOURNAMENT-UI] Mark ready result:`, result);
      
      if (currentUserId) {
        setReadyPlayers(prev => {
          if (prev.includes(currentUserId)) return prev;
          return [...prev, currentUserId];
        });
      }
      
      toast({
        title: "Готовность подтверждена",
        description: "Ожидание подтверждения других игроков...",
        variant: "default",
      });
      
      if (result.allReady && result.tournamentId) {
        console.log(`[TOURNAMENT-UI] All players ready after marking this user. Tournament ID: ${result.tournamentId}`);
        
        toast({
          title: "Турнир начинается!",
          description: "Все игроки готовы. Переход к турниру...",
          variant: "default",
        });
        
        setTimeout(() => {
          navigate(`/tournaments/${result.tournamentId}`);
        }, 1000);
      } else if (readyPlayers.length + 1 === 4 && !isCreatingTournament) {
        console.log(`[TOURNAMENT-UI] Potentially all players ready. Checking tournament creation...`);
        setTimeout(() => {
          checkTournamentCreation();
        }, 500);
      }
    } catch (error: any) {
      console.error("[TOURNAMENT-UI] Error marking as ready:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось подтвердить готовность",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isUserReady = () => {
    const ready = currentUserId ? readyPlayers.includes(currentUserId) : false;
    return ready;
  };

  const renderTournamentCreationStatus = () => {
    if (!tournamentCreationStatus || tournamentCreationStatus === 'waiting') return null;
    
    return (
      <div className="my-2 text-center">
        {tournamentCreationStatus === 'checking' && (
          <div className="text-yellow-500 flex items-center justify-center">
            <Loader2 className="mr-2 animate-spin" size={16} />
            Подготовка турнира...
          </div>
        )}
        {tournamentCreationStatus === 'created' && (
          <div className="text-green-500 flex items-center justify-center">
            <Check className="mr-2" size={16} />
            Турнир создан! Переход...
          </div>
        )}
        {tournamentCreationStatus === 'failed' && (
          <div className="text-red-500 flex items-center justify-center">
            <AlertTriangle className="mr-2" size={16} />
            Ошибка создания турнира. Отмена поиска...
          </div>
        )}
        {tournamentCreationStatus === 'error' && (
          <div className="text-red-500 flex items-center justify-center">
            <X className="mr-2" size={16} />
            Ошибка системы. Попробуйте снова.
          </div>
        )}
      </div>
    );
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
              <h4 className="text-sm font-medium mb-2">Участники ({lobbyParticipants.length}/4):</h4>
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
          
          {renderTournamentCreationStatus()}
          
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
