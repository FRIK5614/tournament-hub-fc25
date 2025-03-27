
import { Loader2 } from 'lucide-react';
import TournamentChat from './TournamentChat';
import MainTournamentContent from './lobby/MainTournamentContent';
import { useTournamentLobbyData } from '@/hooks/useTournamentLobbyData';

interface TournamentLobbyProps {
  tournamentId: string;
}

const TournamentLobby = ({ tournamentId }: TournamentLobbyProps) => {
  const {
    loading,
    tournament,
    playerMatches,
    standings,
    userId,
    getCurrentMatch
  } = useTournamentLobbyData(tournamentId);

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
        <MainTournamentContent
          tournament={tournament}
          standings={standings}
          currentMatch={currentMatch}
          playerMatches={playerMatches}
          userId={userId}
          isLoading={loading}
        />
      </div>
    </div>
  );
};

export default TournamentLobby;
