
import { useNavigate } from 'react-router-dom';
import { useTournamentSearch } from '@/hooks/useTournamentSearch';
import TournamentIntro from './TournamentIntro';
import TournamentSearchStatus from './TournamentSearchStatus';
import ReadyCheck from './ReadyCheck';
import { useEffect } from 'react';

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

  return (
    <div className="glass-card p-6">
      <h3 className="text-xl font-semibold mb-4">Быстрый турнир</h3>
      
      {!isSearching && (
        <TournamentIntro 
          onStartSearch={() => handleStartSearch()} 
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
