
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { LobbyParticipant } from '@/hooks/useTournamentSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ReadyCheckProps {
  countdownSeconds: number;
  lobbyParticipants: LobbyParticipant[];
  readyPlayers: string[];
  isUserReady: boolean;
  isLoading: boolean;
  tournamentCreationStatus: string;
  onReady: () => void;
  onCancel: () => void;
}

const ReadyCheck = ({
  countdownSeconds,
  lobbyParticipants,
  readyPlayers,
  isUserReady,
  isLoading,
  tournamentCreationStatus,
  onReady,
  onCancel
}: ReadyCheckProps) => {
  // Helper to determine if player is ready
  const isPlayerReady = (participant: LobbyParticipant) => {
    return readyPlayers.includes(participant.user_id);
  };

  // Helper to determine if player is in ready check
  const isPlayerInReadyCheck = (participant: LobbyParticipant) => {
    return participant.status === 'ready';
  };

  // Render tournament creation status
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
            Ошибка создания турнира. Повторная попытка...
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

  // Count ready players for debugging
  const readyCount = lobbyParticipants.filter(p => isPlayerReady(p)).length;
  const totalCount = lobbyParticipants.length;
  const searchingCount = lobbyParticipants.filter(p => p.status === 'searching').length;
  
  console.log(`[TOURNAMENT-UI] Ready players: ${readyCount}/${totalCount}, Searching: ${searchingCount}`);
  console.log("[TOURNAMENT-UI] Ready check participants:", 
    lobbyParticipants.map(p => ({ 
      id: p.user_id, 
      username: p.profile?.username,
      ready: isPlayerReady(p), 
      status: p.status 
    }))
  );

  return (
    <div className="text-center">
      <h4 className="text-lg font-medium mb-2">Все игроки найдены!</h4>
      <p className="text-gray-300 mb-2">Подтвердите готовность начать турнир ({readyCount}/{totalCount})</p>
      
      <div className="flex justify-center mb-4">
        <Badge variant="outline" className="bg-yellow-500/20 border-yellow-500 px-3 py-1 rounded-full text-sm">
          {countdownSeconds} сек.
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {lobbyParticipants.map((participant, idx) => (
          <div 
            key={idx} 
            className={`glass-card p-3 flex items-center justify-between ${
              isPlayerReady(participant) 
                ? 'border-green-500' 
                : !isPlayerInReadyCheck(participant)
                  ? 'border-orange-500'
                  : 'border-gray-500'
            }`}
          >
            <span>{participant.profile?.username || 'Игрок'}</span>
            {isPlayerReady(participant) ? (
              <div className="flex items-center">
                <span className="text-green-500 mr-1 text-xs">Готов</span>
                <Check className="text-green-500" size={18} />
              </div>
            ) : !isPlayerInReadyCheck(participant) ? (
              <div className="flex items-center">
                <span className="text-orange-500 mr-1 text-xs">В поиске</span>
                <Loader2 className="animate-spin text-orange-500" size={14} />
              </div>
            ) : (
              <div className="flex items-center">
                <span className="text-yellow-500 mr-1 text-xs">Ожидание</span>
                <Loader2 className="animate-spin text-yellow-500" size={18} />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {renderTournamentCreationStatus()}
      
      <div className="flex gap-3 justify-center">
        {!isUserReady && (
          <Button 
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={onReady}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin mr-2" />
            ) : (
              <Check size={18} className="mr-2" />
            )}
            Я готов
          </Button>
        )}
        
        <Button 
          variant="outline"
          className="bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          onClick={onCancel}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin mr-2" />
          ) : (
            <X size={18} className="mr-2" />
          )}
          Отмена
        </Button>
      </div>
    </div>
  );
};

export default ReadyCheck;
