
import { Loader2, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { LobbyParticipant } from '@/hooks/useTournamentSearch';
import { Button } from '@/components/ui/button';

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
  const participantCount = lobbyParticipants.length || 0;
  
  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-4">
        <Loader2 className="animate-spin mr-2" size={20} />
        <span>Поиск игроков {participantCount}/4...</span>
      </div>
      
      {participantCount === 0 && (
        <div className="glass-card bg-orange-500/10 p-4 mb-4 text-sm">
          <AlertTriangle className="inline-block mr-2 text-orange-500" size={18} />
          <span className="text-orange-400">
            Игроков пока не найдено. Подождите немного или попробуйте повторить поиск.
          </span>
        </div>
      )}
      
      {participantCount > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Участники ({participantCount}/4):</h4>
          <div className="flex flex-wrap justify-center gap-2">
            {lobbyParticipants.map((participant, idx) => (
              <div key={idx} className="glass-card p-2 text-xs flex items-center">
                <span className="text-green-400 mr-1">●</span>
                {participant.profile?.username || `Player-${participant.user_id.substring(0, 6)}`}
              </div>
            ))}
            {Array(4 - participantCount).fill(0).map((_, idx) => (
              <div key={`empty-${idx}`} className="glass-card bg-opacity-30 p-2 text-xs text-gray-500">
                Ожидание...
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex justify-center gap-2">
        <Button 
          variant="outline"
          className="bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          onClick={onCancel}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
          Отменить поиск
        </Button>
        
        {onRetry && (
          <Button 
            variant="outline"
            className="bg-blue-500/20 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
            onClick={onRetry}
            disabled={isLoading}
          >
            <RefreshCw size={18} className="mr-2" />
            Повторить поиск
          </Button>
        )}
      </div>
    </div>
  );
};

export default TournamentSearchStatus;
