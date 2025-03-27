
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { LobbyParticipant } from '@/hooks/useTournamentSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

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

  // Check if all players are ready - important: we check actual length
  const allPlayersReady = lobbyParticipants.length === 4 && 
    lobbyParticipants.every(p => isPlayerReady(p));

  // Check if countdown has expired
  const isCountdownExpired = countdownSeconds <= 0;

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Calculate progress percentage
  const progressPercentage = (countdownSeconds / 120) * 100;

  // Render tournament creation status
  const renderTournamentCreationStatus = () => {
    if (isCountdownExpired || allPlayersReady) {
      if (!tournamentCreationStatus || tournamentCreationStatus === 'waiting') {
        return (
          <motion.div 
            className="my-2 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-yellow-500 flex items-center justify-center">
              <Loader2 className="mr-2 animate-spin" size={16} />
              Создание турнира...
            </div>
          </motion.div>
        );
      }
      
      return (
        <motion.div 
          className="my-2 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {tournamentCreationStatus === 'checking' && (
            <div className="text-yellow-500 flex items-center justify-center">
              <Loader2 className="mr-2 animate-spin" size={16} />
              Подготовка турнира...
            </div>
          )}
          {tournamentCreationStatus === 'creating' && (
            <div className="text-yellow-500 flex items-center justify-center">
              <Loader2 className="mr-2 animate-spin" size={16} />
              Создание турнира...
            </div>
          )}
          {tournamentCreationStatus === 'created' && (
            <div className="text-green-500 flex items-center justify-center">
              <Check className="mr-2" size={16} />
              Турнир создан! Переход...
            </div>
          )}
          {tournamentCreationStatus === 'failed' && (
            <div className="text-orange-500 flex items-center justify-center">
              <AlertTriangle className="mr-2" size={16} />
              Ошибка создания турнира. Повторная попытка...
            </div>
          )}
          {tournamentCreationStatus === 'error' && (
            <div className="text-red-500 flex items-center justify-center">
              <X className="mr-2" size={16} />
              Ошибка: недостаточно игроков. Пробуем еще...
            </div>
          )}
        </motion.div>
      );
    }
    
    return null;
  };

  // Count ready players for debugging
  const readyCount = readyPlayers.length;
  const totalCount = lobbyParticipants.length;
  
  // Enhanced logging to help debug
  useEffect(() => {
    console.log(`[TOURNAMENT-UI] Ready players: ${readyCount}/${totalCount}`);
    console.log("[TOURNAMENT-UI] Ready players array:", readyPlayers);
    console.log("[TOURNAMENT-UI] Ready check participants:", 
      lobbyParticipants.map(p => ({ 
        id: p.user_id, 
        username: p.profile?.username,
        ready: isPlayerReady(p), 
        status: p.status 
      }))
    );
    
    // Critical: Log a warning if we don't have exactly 4 players
    if (lobbyParticipants.length !== 4) {
      console.warn(`[TOURNAMENT-UI] Warning: Expected 4 participants but found ${lobbyParticipants.length}`);
    }
  }, [readyCount, totalCount, readyPlayers, lobbyParticipants]);
  
  // Improved display for expired timer
  const renderExpiredTimerMessage = () => {
    if (isCountdownExpired && !tournamentCreationStatus) {
      return (
        <motion.div 
          className="mb-4 p-2 bg-yellow-500/20 rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-yellow-500 font-medium">
            Время ожидания истекло! Создаем турнир автоматически...
          </p>
          {lobbyParticipants.length < 4 && (
            <p className="text-red-400 text-sm mt-1">
              Внимание: для начала турнира необходимо 4 игрока, сейчас {lobbyParticipants.length}
            </p>
          )}
        </motion.div>
      );
    }
    return null;
  };

  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.h4 
        className="text-lg font-semibold mb-2"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Все игроки найдены!
      </motion.h4>
      
      <motion.p 
        className="text-gray-300 mb-3"
        initial={{ y: -5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Подтвердите готовность начать турнир ({readyCount}/{totalCount})
      </motion.p>
      
      {/* Display warning if we don't have 4 players */}
      {totalCount !== 4 && (
        <motion.div 
          className="mb-3 p-2 bg-orange-500/20 rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-orange-400 text-sm">
            Внимание: для начала турнира необходимо 4 игрока, сейчас только {totalCount}
          </p>
        </motion.div>
      )}
      
      {renderExpiredTimerMessage()}
      
      {!isCountdownExpired && (
        <motion.div 
          className="mb-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex justify-center items-center gap-2 mb-2">
            <Badge variant="outline" className={`${countdownSeconds < 30 ? 'bg-red-500/20 border-red-500' : 'bg-yellow-500/20 border-yellow-500'} px-3 py-1 rounded-full text-sm font-medium`}>
              {formatTime(countdownSeconds)}
            </Badge>
          </div>
          
          <div className="w-full max-w-md mx-auto">
            <Progress 
              value={progressPercentage} 
              className="h-1 bg-gray-700" 
              indicatorClassName={countdownSeconds < 30 ? "bg-red-500" : "bg-yellow-500"} 
            />
          </div>
        </motion.div>
      )}
      
      <motion.div 
        className="grid grid-cols-2 gap-4 mb-4"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, staggerChildren: 0.1 }}
      >
        {lobbyParticipants.map((participant, idx) => (
          <motion.div 
            key={idx} 
            className={`glass-card p-3 flex items-center justify-between ${
              isPlayerReady(participant) 
                ? 'border-green-500' 
                : !isPlayerInReadyCheck(participant)
                  ? 'border-orange-500'
                  : isCountdownExpired ? 'border-red-500' : 'border-gray-500'
            }`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + (idx * 0.1) }}
          >
            <span>{participant.profile?.username || `Игрок-${participant.user_id.substring(0, 6)}`}</span>
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
            ) : isCountdownExpired ? (
              <div className="flex items-center">
                <span className="text-red-500 mr-1 text-xs">Время истекло</span>
                <AlertTriangle className="text-red-500" size={18} />
              </div>
            ) : (
              <div className="flex items-center">
                <span className="text-yellow-500 mr-1 text-xs">Ожидание</span>
                <Loader2 className="animate-spin text-yellow-500" size={18} />
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
      
      {renderTournamentCreationStatus()}
      
      <motion.div 
        className="flex gap-3 justify-center"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {!isUserReady && !isCountdownExpired && (
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
          disabled={isLoading || tournamentCreationStatus === 'created'}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin mr-2" />
          ) : (
            <X size={18} className="mr-2" />
          )}
          Отмена
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default ReadyCheck;
