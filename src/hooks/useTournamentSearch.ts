
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  searchForQuickTournament, 
  markUserAsReady, 
  checkAllPlayersReady, 
  leaveQuickTournament,
  getLobbyStatus
} from '@/services/tournament';

export interface LobbyParticipant {
  id: string;
  user_id: string;
  lobby_id: string;
  is_ready: boolean;
  status: string;
  profile?: {
    username: string;
    avatar_url: string | null;
  };
}

export function useTournamentSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [readyCheckActive, setReadyCheckActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(30);
  const [lobbyParticipants, setLobbyParticipants] = useState<LobbyParticipant[]>([]);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [searchAttempts, setSearchAttempts] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTournament, setIsCreatingTournament] = useState(false);
  const [tournamentCreationStatus, setTournamentCreationStatus] = useState('');
  const [creationAttempts, setCreationAttempts] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch current user ID
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setCurrentUserId(data.user.id);
          console.log(`[TOURNAMENT-UI] Current user ID: ${data.user.id}`);
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error fetching user:", error);
      }
    };
    
    fetchUser();
  }, []);

  // Handle cancelling search
  const handleCancelSearch = async () => {
    if (!lobbyId) {
      setIsSearching(false);
      setSearchAttempts(0);
      return;
    }
    
    try {
      console.log(`[TOURNAMENT-UI] Cancelling search for lobby ${lobbyId}`);
      setIsLoading(true);
      
      if (currentUserId) {
        await leaveQuickTournament(lobbyId);
        console.log(`[TOURNAMENT-UI] User ${currentUserId} left lobby ${lobbyId}`);
      }
      
      setIsSearching(false);
      setLobbyId(null);
      setReadyCheckActive(false);
      setSearchAttempts(0);
      setTournamentCreationStatus('');
      setCreationAttempts(0);
      
      toast({
        title: "Поиск отменен",
        description: "Вы вышли из поиска турнира",
        variant: "default",
      });
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error canceling search:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check tournament creation function
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
        
        if (creationAttempts >= 3) {
          toast({
            title: "Ошибка создания турнира",
            description: "Не удалось создать турнир после нескольких попыток. Поиск отменен.",
            variant: "destructive",
          });
          
          setTimeout(() => {
            handleCancelSearch();
          }, 3000);
        } else {
          setCreationAttempts(prev => prev + 1);
          toast({
            title: "Повторная попытка",
            description: "Пытаемся создать турнир еще раз...",
            variant: "default",
          });
          
          setTimeout(() => {
            setIsCreatingTournament(false);
            setTournamentCreationStatus('waiting');
            checkTournamentCreation();
          }, 2000);
        }
      } else {
        setTournamentCreationStatus('waiting');
      }
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error checking tournament creation:", error);
      setTournamentCreationStatus('error');
      
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при создании турнира. Поиск отменен.",
        variant: "destructive",
      });
      
      setTimeout(() => {
        handleCancelSearch();
      }, 3000);
    } finally {
      if (tournamentCreationStatus !== 'waiting') {
        setIsCreatingTournament(false);
      }
    }
  }, [lobbyId, navigate, toast, isCreatingTournament, creationAttempts, handleCancelSearch, tournamentCreationStatus]);

  // Lobby subscription and participants tracking
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
          }, 500);
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
          
          // Reset the countdown
          setCountdownSeconds(30);
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
              profile: profile || { username: 'Игрок', avatar_url: null }
            };
          });
          
          setLobbyParticipants(participantsWithProfiles);
          
          const readyPlayerIds = participantsWithProfiles
            .filter(p => p.is_ready && p.status === 'ready')
            .map(p => p.user_id) || [];
          setReadyPlayers(readyPlayerIds);
          
          console.log(`[TOURNAMENT-UI] Ready players: ${readyPlayerIds.length}/${participantsWithProfiles.length}`);
          
          if (readyPlayerIds.length === 4 && 
              participantsWithProfiles.length === 4 && 
              isReadyCheckActive && 
              !isCreatingTournament) {
            console.log(`[TOURNAMENT-UI] All 4 players are ready. Triggering tournament creation check`);
            setTimeout(() => { checkTournamentCreation(); }, 500);
          }
        } else {
          setLobbyParticipants([]);
          setReadyPlayers([]);
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
      }
    };

    // Initial fetch
    fetchLobbyParticipants();
    
    // Set up subscriptions
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
        fetchLobbyParticipants();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(lobbyChannel);
      supabase.removeChannel(lobbyStatusChannel);
    };
  }, [lobbyId, navigate, toast, readyCheckActive, checkTournamentCreation, isCreatingTournament]);

  // Retry search if needed
  useEffect(() => {
    if (isSearching && !lobbyId && searchAttempts > 0 && searchAttempts < 5) {
      const retryTimer = setTimeout(() => {
        console.log(`[TOURNAMENT-UI] Retrying search, attempt #${searchAttempts + 1}`);
        handleStartSearch(true);
      }, 2000);
      
      return () => clearTimeout(retryTimer);
    }
    
    if (searchAttempts >= 5) {
      setIsSearching(false);
      setSearchAttempts(0);
      
      toast({
        title: "Не удалось найти турнир",
        description: "Слишком много попыток. Пожалуйста, попробуйте позже.",
        variant: "destructive",
      });
    }
  }, [isSearching, lobbyId, searchAttempts, toast]);

  // Ready check countdown
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
  }, [countdownSeconds, readyCheckActive, toast]);

  // Start search for tournament
  const handleStartSearch = async (isRetry = false) => {
    try {
      console.log(`[TOURNAMENT-UI] Starting tournament search${isRetry ? ' (retry)' : ''}`);
      setIsSearching(true);
      setIsLoading(true);
      
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
    } finally {
      setIsLoading(false);
    }
  };

  // Handle user ready check
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
        }, 800);
      } else if (readyPlayers.length + 1 >= 3 && !isCreatingTournament) {
        // If this might complete the ready player set, check for tournament creation
        console.log(`[TOURNAMENT-UI] May have all players ready now. Checking tournament creation...`);
        setTimeout(() => {
          checkTournamentCreation();
        }, 800);
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

  // Check if current user is ready
  const isUserReady = () => {
    return currentUserId ? readyPlayers.includes(currentUserId) : false;
  };

  return {
    isSearching,
    lobbyId,
    readyCheckActive,
    countdownSeconds,
    lobbyParticipants,
    readyPlayers,
    isLoading,
    tournamentCreationStatus,
    isCreatingTournament,
    currentUserId,
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady
  };
}
