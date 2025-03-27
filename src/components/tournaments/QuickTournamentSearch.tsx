
import { useNavigate } from 'react-router-dom';
import { useTournamentSearch } from '@/hooks/useTournamentSearch';
import TournamentIntro from './lobby/TournamentIntro';
import TournamentSearchStatus from './lobby/TournamentSearchStatus';
import ReadyCheck from './lobby/ReadyCheck';
import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

const QuickTournamentSearch = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const lastCountdownSeconds = useRef<number | null>(null);
  
  const {
    isSearching,
    readyCheckActive,
    countdownSeconds,
    lobbyParticipants,
    readyPlayers,
    isLoading,
    tournamentCreationStatus,
    isCreatingTournament,
    tournamentId,
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady,
    checkTournamentCreation
  } = useTournamentSearch();

  // Debug logging with null checks
  useEffect(() => {
    console.log("[TOURNAMENT-UI] QuickTournamentSearch render state:", {
      isSearching,
      readyCheckActive,
      participantsCount: lobbyParticipants?.length || 0,
      readyPlayersCount: readyPlayers?.length || 0,
      isLoading,
      tournamentCreationStatus,
      isCreatingTournament,
      tournamentId,
      countdownSeconds,
      lobbyParticipants
    });
  }, [isSearching, readyCheckActive, lobbyParticipants, readyPlayers, isLoading, 
      tournamentCreationStatus, isCreatingTournament, tournamentId, countdownSeconds]);

  // Handle page close during search
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSearching || readyCheckActive) {
        // Try to cancel search when closing the page
        handleCancelSearch();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSearching, readyCheckActive, handleCancelSearch]);

  // Автоматически запускаем создание турнира, когда таймер истекает
  useEffect(() => {
    // Отслеживаем переход countdownSeconds через 0
    if (
      readyCheckActive && 
      lastCountdownSeconds.current !== null && 
      lastCountdownSeconds.current > 0 && 
      countdownSeconds <= 0 && 
      !isCreatingTournament &&
      !tournamentId &&
      lobbyParticipants?.length >= 4
    ) {
      console.log("[TOURNAMENT-UI] Timer expired, auto-triggering tournament creation");
      checkTournamentCreation();
      
      toast({
        title: "Время ожидания истекло",
        description: "Создаем турнир автоматически...",
        variant: "default",
      });
    }
    
    // Сохраняем текущее значение для следующего сравнения
    lastCountdownSeconds.current = countdownSeconds;
  }, [
    countdownSeconds, 
    readyCheckActive, 
    isCreatingTournament, 
    tournamentId, 
    lobbyParticipants?.length, 
    checkTournamentCreation, 
    toast
  ]);

  // Автоматически проверяем создание турнира, если все игроки готовы
  useEffect(() => {
    if (
      readyCheckActive && 
      !isCreatingTournament && 
      !tournamentId &&
      lobbyParticipants?.length >= 4 && 
      readyPlayers?.length >= 4
    ) {
      console.log("[TOURNAMENT-UI] All players ready, triggering tournament creation");
      checkTournamentCreation();
    }
  }, [
    readyCheckActive, 
    readyPlayers?.length, 
    isCreatingTournament, 
    tournamentId, 
    lobbyParticipants?.length, 
    checkTournamentCreation
  ]);

  // Add navigation effect when tournamentId is set
  useEffect(() => {
    if (tournamentId) {
      toast({
        title: "Турнир готов!",
        description: "Переходим на страницу турнира...",
        variant: "default",
      });
      
      // Short delay before navigation for toast to be visible
      setTimeout(() => {
        navigate(`/tournaments/${tournamentId}`);
      }, 800);
    }
  }, [tournamentId, navigate, toast]);

  const startSearchWithErrorHandling = () => {
    console.log("[TOURNAMENT-UI] Start search button clicked");
    try {
      handleStartSearch();
    } catch (error) {
      console.error("Error starting search:", error);
      toast({
        title: "Ошибка поиска",
        description: "Не удалось начать поиск турнира. Попробуйте позже.",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div 
      className="glass-card p-6 overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.h3 
        className="text-xl font-semibold mb-4 flex items-center"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <span className="text-fc-accent mr-2">#</span>
        Быстрый турнир
      </motion.h3>
      
      {!isSearching && (
        <TournamentIntro 
          onStartSearch={startSearchWithErrorHandling} 
          isLoading={isLoading} 
        />
      )}
      
      {isSearching && !readyCheckActive && (
        <TournamentSearchStatus 
          lobbyParticipants={lobbyParticipants || []} 
          isLoading={isLoading}
          onCancel={handleCancelSearch}
          onRetry={() => handleStartSearch(true)}
        />
      )}
      
      {readyCheckActive && (
        <ReadyCheck 
          countdownSeconds={countdownSeconds}
          lobbyParticipants={lobbyParticipants || []}
          readyPlayers={readyPlayers || []}
          isUserReady={isUserReady()}
          isLoading={isLoading}
          tournamentCreationStatus={tournamentCreationStatus}
          onReady={handleReadyCheck}
          onCancel={handleCancelSearch}
        />
      )}
    </motion.div>
  );
};

export default QuickTournamentSearch;
