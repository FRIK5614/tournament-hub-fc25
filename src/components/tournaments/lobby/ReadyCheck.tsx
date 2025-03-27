
import { Check, X, Loader2, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { LobbyParticipant } from '@/hooks/useTournamentSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Check if all players are ready
  const allPlayersReady = lobbyParticipants.length > 0 && 
    lobbyParticipants.every(p => isPlayerReady(p));

  // Check if countdown has expired
  const isCountdownExpired = countdownSeconds <= 0;

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Calculate countdown progress percentage
  const countdownProgress = (countdownSeconds / 120) * 100;

  // Render tournament creation status
  const renderTournamentCreationStatus = () => {
    if (isCountdownExpired || allPlayersReady) {
      if (!tournamentCreationStatus || tournamentCreationStatus === 'waiting') {
        return (
          <motion.div 
            className="my-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
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
          className="my-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
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
            <div className="text-orange-500 flex items-center justify-center">
              <AlertTriangle className="mr-2" size={16} />
              Ошибка создания турнира. Повторная попытка...
            </div>
          )}
          {tournamentCreationStatus === 'error' && (
            <div className="text-red-500 flex items-center justify-center">
              <X className="mr-2" size={16} />
              Ошибка системы. Пробуем другой способ...
            </div>
          )}
        </motion.div>
      );
    }
    
    return null;
  };

  // Count ready players
  const readyCount = lobbyParticipants.filter(p => isPlayerReady(p)).length;
  const totalCount = lobbyParticipants.length;

  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.h4 
        className="text-lg font-medium mb-2"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Все игроки найдены!
      </motion.h4>
      
      <motion.p 
        className="text-gray-300 mb-4"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Подтвердите готовность начать турнир
        <Badge variant="outline" className="ml-2 bg-fc-accent/10 border-fc-accent/20">
          {readyCount}/{totalCount}
        </Badge>
      </motion.p>
      
      {!isCountdownExpired && (
        <motion.div 
          className="mb-5"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400 flex items-center">
              <Clock size={14} className="mr-1" />
              Таймер готовности
            </span>
            <span className="font-medium text-yellow-500">{formatTime(countdownSeconds)}</span>
          </div>
          <Progress value={countdownProgress} className="h-2 bg-gray-800" indicatorClassName="bg-yellow-500" />
        </motion.div>
      )}
      
      <motion.div 
        className="grid grid-cols-2 gap-4 mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <AnimatePresence mode="wait">
          {lobbyParticipants.map((participant, idx) => (
            <motion.div 
              key={participant.user_id || idx}
              className={`glass-card p-3 flex items-center justify-between border ${
                isPlayerReady(participant) 
                  ? 'border-green-500/40 bg-green-500/5' 
                  : !isPlayerInReadyCheck(participant)
                    ? 'border-orange-500/40 bg-orange-500/5'
                    : 'border-gray-500/20'
              } transition-all duration-300`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center">
                {participant.profile?.avatar_url ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 mr-2">
                    <img 
                      src={participant.profile.avatar_url}
                      alt={participant.profile.username || "Участник"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-fc-background/50 border border-white/10 flex items-center justify-center mr-2">
                    <span className="text-xs">
                      {participant.profile?.username?.substring(0, 2).toUpperCase() || "??"}
                    </span>
                  </div>
                )}
                <span className="truncate max-w-[80px]">
                  {participant.profile?.username || `Игрок-${participant.user_id.substring(0, 6)}`}
                </span>
              </div>
              
              {isPlayerReady(participant) ? (
                <div className="flex items-center">
                  <span className="text-green-500 mr-1 text-xs">Готов</span>
                  <Badge variant="outline" className="bg-green-500/20 border-green-500/20 h-6 w-6 p-0 flex items-center justify-center">
                    <Check className="text-green-500" size={12} />
                  </Badge>
                </div>
              ) : !isPlayerInReadyCheck(participant) ? (
                <div className="flex items-center">
                  <span className="text-orange-500 mr-1 text-xs">В поиске</span>
                  <Badge variant="outline" className="bg-orange-500/20 border-orange-500/20 h-6 w-6 p-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-orange-500" size={12} />
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center">
                  <span className="text-yellow-500 mr-1 text-xs">Ожидание</span>
                  <Badge variant="outline" className="bg-yellow-500/20 border-yellow-500/20 h-6 w-6 p-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-yellow-500" size={12} />
                  </Badge>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
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
            className="bg-green-600 hover:bg-green-700 transition-all duration-300 hover:shadow-[0_0_10px_rgba(0,255,0,0.3)]"
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
          className="bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 hover:text-red-400"
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
