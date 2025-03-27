
import { useNavigate } from 'react-router-dom';
import { useTournamentSearch } from '@/hooks/useTournamentSearch';
import TournamentIntro from './TournamentIntro';
import TournamentSearchStatus from './TournamentSearchStatus';
import ReadyCheck from './ReadyCheck';
import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

const QuickTournamentSearch = () => {
  const navigate = useNavigate();
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
      isCreatingTournament
    });
  }, [isSearching, readyCheckActive, lobbyParticipants, readyPlayers, isLoading, tournamentCreationStatus, isCreatingTournament]);

  // Показываем тост с ошибкой, если происходит ошибка поиска
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSearching || readyCheckActive) {
        // Пытаемся отменить поиск при закрытии страницы
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

  // Add navigation effect when tournamentId is set
  useEffect(() => {
    if (tournamentId) {
      navigate(`/tournaments/${tournamentId}`);
    }
  }, [tournamentId, navigate]);

  return (
    <div className="glass-card p-6">
      <h3 className="text-xl font-semibold mb-4">Быстрый турнир</h3>
      
      {!isSearching && (
        <TournamentIntro 
          onStartSearch={() => {
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
          }} 
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
    </div>
  );
};

export default QuickTournamentSearch;
