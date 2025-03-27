
import { Loader2, Users, RefreshCw } from 'lucide-react';
import { LobbyParticipant } from '@/hooks/useTournamentSearch';

interface TournamentSearchStatusProps {
  lobbyParticipants: LobbyParticipant[];
  isLoading: boolean;
  onCancel: () => void;
  onRetry?: () => void;
}

const TournamentSearchStatus = ({ 
  lobbyParticipants, 
  isLoading, 
  onCancel,
  onRetry
}: TournamentSearchStatusProps) => {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-4">
        <Loader2 className="animate-spin mr-2" size={20} />
        <span>Поиск игроков {lobbyParticipants.length}/4...</span>
      </div>
      
      {lobbyParticipants.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Участники ({lobbyParticipants.length}/4):</h4>
          <div className="flex flex-wrap justify-center gap-2">
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
      
      <div className="flex justify-center gap-2">
        <button 
          className="btn-outline bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          onClick={onCancel}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
          Отменить поиск
        </button>
        
        {onRetry && (
          <button 
            className="btn-outline bg-blue-500/20 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
            onClick={onRetry}
            disabled={isLoading}
          >
            <RefreshCw size={18} className="mr-2" />
            Повторить поиск
          </button>
        )}
      </div>
    </div>
  );
};

export default TournamentSearchStatus;
