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
  const { toast } = useToast();
  const navigate = useNavigate();

  // Subscribe to lobby changes when we have a lobbyId
  useEffect(() => {
    if (!lobbyId) return;

    const fetchLobbyParticipants = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;
        
        // Get the current lobby information with its current player count
        const { data: lobbyData, error: lobbyError } = await supabase
          .from('tournament_lobbies')
          .select('current_players')
          .eq('id', lobbyId)
          .single();
        
        if (lobbyError) {
          console.error("Error fetching lobby:", lobbyError);
          return;
        }
        
        // Get all participant data
        const { data, error } = await supabase
          .from('lobby_participants')
          .select('*, profiles:user_id(username, avatar_url)')
          .eq('lobby_id', lobbyId)
          .eq('status', 'searching');
        
        if (error) {
          console.error("Error fetching lobby participants:", error);
          return;
        }
        
        console.log("Lobby participants:", data);
        setLobbyParticipants(data || []);
        setReadyPlayers(data?.filter(p => p.is_ready).map(p => p.user_id) || []);
      } catch (error) {
        console.error("Error in fetchLobbyParticipants:", error);
      }
    };

    fetchLobbyParticipants();

    // Subscribe to ALL changes to lobby_participants (additions and removals)
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
      
    // Subscribe to tournament_lobbies changes to detect ready check and tournament start
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
        
        if (newStatus === 'ready_check') {
          setReadyCheckActive(true);
          setCountdownSeconds(30); // Reset countdown for ready check
        } else if (newStatus === 'active') {
          // Tournament has started, navigate to the tournament page
          if (payload.new.tournament_id) {
            toast({
              title: "Турнир начинается!",
              description: "Все игроки готовы. Переход к турниру...",
              variant: "default",
            });
            
            navigate(`/tournaments/${payload.new.tournament_id}`);
          }
        }
        
        // Refresh participants when status changes
        fetchLobbyParticipants();
      })
      .subscribe();
      
    // Clean up subscriptions
    return () => {
      supabase.removeChannel(lobbyChannel);
      supabase.removeChannel(lobbyStatusChannel);
    };
  }, [lobbyId, navigate, toast]);

  // Retry search if it fails
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

  // If countdown reaches 0, cancel search
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
        // Only show toast on initial search, not on retries
        toast({
          title: "Поиск турнира",
          description: "Поиск быстрого турнира начат. Ожидание других игроков...",
          variant: "default",
        });
      }
      
      const newLobbyId = await searchForQuickTournament();
      setLobbyId(newLobbyId);
      
      // Immediately after joining, set lobbyParticipants to include current user
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.user.id)
          .single();
          
        if (profile) {
          setLobbyParticipants([{
            user_id: user.user.id,
            lobby_id: newLobbyId,
            is_ready: false,
            profiles: profile
          }]);
        }
      }
      
      setSearchAttempts(0); // Reset attempts on success
    } catch (error: any) {
      console.error("Error searching for tournament:", error);
      
      // Only show error toast on first few attempts
      if (searchAttempts < 3) {
        toast({
          title: "Повторная попытка поиска",
          description: "Возникла проблема при поиске. Пробуем еще раз...",
          variant: "default",
        });
      }
      
      // Increment search attempts for retry logic
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
      // Update participant status to 'left'
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
      await markUserAsReady(lobbyId);
      
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
    const { data } = supabase.auth.getSession();
    return readyPlayers.some(id => id === data?.session?.user?.id);
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
                    {participant.profiles?.username || 'Игрок'}
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
                <span>{participant.profiles?.username || 'Игрок'}</span>
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
