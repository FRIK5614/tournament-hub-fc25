
import { X, RefreshCw, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LobbyParticipant } from '@/hooks/useTournamentSearch';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface TournamentSearchStatusProps {
  lobbyParticipants: LobbyParticipant[];
  isLoading: boolean;
  onCancel: () => void;
  onRetry: () => void;
}

const TournamentSearchStatus = ({
  lobbyParticipants,
  isLoading,
  onCancel,
  onRetry
}: TournamentSearchStatusProps) => {
  const participantCount = lobbyParticipants?.length || 0;
  const searchProgress = (participantCount / 4) * 100;
  
  // Добавляем логирование для отладки
  useEffect(() => {
    console.log("[TOURNAMENT-UI] Render TournamentSearchStatus with participants:", lobbyParticipants);
  }, [lobbyParticipants]);

  // Helper for placeholder avatars when none is available
  const getInitials = (username: string) => {
    return username?.substring(0, 2).toUpperCase() || '??';
  };

  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      exit={{ opacity: 0 }}
    >
      <motion.h4 
        className="text-lg font-medium mb-2"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Поиск турнира
      </motion.h4>
      
      <motion.p 
        className="text-gray-300 mb-4"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Ищем других игроков для турнира...
      </motion.p>

      <motion.div 
        className="mb-5"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-400">Подбор участников</span>
          <span className="font-medium">{participantCount}/4</span>
        </div>
        <Progress value={searchProgress} className="h-2 bg-gray-800" indicatorClassName="bg-fc-accent" />
      </motion.div>
      
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="text-sm text-gray-300 mb-3">Найдено игроков: {participantCount}</div>
        
        <div className="flex justify-center gap-2">
          <AnimatePresence>
            {lobbyParticipants && lobbyParticipants.map((participant, index) => (
              <motion.div
                key={participant.user_id || index}
                className="flex flex-col items-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                {participant.profile?.avatar_url ? (
                  <div className="w-10 h-10 rounded-full bg-fc-background overflow-hidden border border-white/10 mb-1">
                    <img 
                      src={participant.profile.avatar_url}
                      alt={participant.profile?.username || "Участник"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-fc-background border border-white/10 flex items-center justify-center mb-1">
                    <Users size={16} className="text-fc-accent" />
                  </div>
                )}
                <span className="text-xs truncate max-w-[60px]">
                  {participant.profile?.username || `Игрок ${index + 1}`}
                </span>
              </motion.div>
            ))}
            
            {/* Placeholder for missing players */}
            {Array.from({ length: 4 - participantCount }).map((_, index) => (
              <motion.div
                key={`placeholder-${index}`}
                className="flex flex-col items-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.4 }}
                transition={{ delay: 0.5 + participantCount * 0.1 + index * 0.1 }}
              >
                <div className="w-10 h-10 rounded-full bg-fc-background/40 border border-dashed border-white/10 flex items-center justify-center mb-1">
                  <Loader2 size={14} className="text-gray-500 animate-spin" />
                </div>
                <span className="text-xs text-gray-500">Поиск...</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
      
      <motion.div 
        className="flex gap-3 justify-center"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          variant="outline" 
          size="sm"
          className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
          onClick={onCancel}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin mr-2" />
          ) : (
            <X size={16} className="mr-2" />
          )}
          Отменить
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="border-fc-accent/30 text-fc-accent hover:bg-fc-accent/10 hover:text-fc-accent"
          onClick={onRetry}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin mr-2" />
          ) : (
            <RefreshCw size={16} className="mr-2" />
          )}
          Обновить
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default TournamentSearchStatus;
