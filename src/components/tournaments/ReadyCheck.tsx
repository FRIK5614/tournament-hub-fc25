
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { LobbyParticipant } from '@/hooks/useTournamentSearch';

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

  // Log participants and ready players for debugging
  console.log("[TOURNAMENT-UI] ReadyCheck rendering with participants:", 
    lobbyParticipants.map(p => ({ id: p.user_id, ready: p.is_ready, status: p.status }))
  );
  console.log("[TOURNAMENT-UI] ReadyCheck readyPlayers:", readyPlayers);

  return (
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
                : !isPlayerInReadyCheck(participant)
                  ? 'border-yellow-500'
                  : 'border-gray-500'
            }`}
          >
            <span>{participant.profile?.username || 'Игрок'}</span>
            {readyPlayers.includes(participant.user_id) ? (
              <Check className="text-green-500" size={18} />
            ) : !isPlayerInReadyCheck(participant) ? (
              <div className="flex items-center">
                <span className="text-yellow-500 mr-1 text-xs">В поиске</span>
                <Loader2 className="animate-spin text-yellow-500" size={14} />
              </div>
            ) : (
              <Loader2 className="animate-spin text-yellow-500" size={18} />
            )}
          </div>
        ))}
      </div>
      
      {renderTournamentCreationStatus()}
      
      <div className="flex gap-3 justify-center">
        {!isUserReady && (
          <button 
            className={`btn-primary bg-green-600 hover:bg-green-700 ${isLoading ? 'opacity-50' : ''}`}
            onClick={onReady}
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
          onClick={onCancel}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin mr-2" />
          ) : (
            <X size={18} className="mr-2" />
          )}
          Отмена
        </button>
      </div>
    </div>
  );
};

export default ReadyCheck;
