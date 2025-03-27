
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sword, User, Trophy, Clock } from 'lucide-react';
import { Match } from '@/services/tournament';

interface MatchCardProps {
  match: Match;
  showActions?: boolean;
  isCompact?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, showActions = true, isCompact = false }) => {
  const navigate = useNavigate();
  
  const formatScore = (score: number | undefined) => {
    return typeof score === 'number' ? score.toString() : '-';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Запланирован';
      case 'awaiting_confirmation': return 'Ожидает подтверждения';
      case 'completed': return 'Завершен';
      default: return 'Неизвестный статус';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-yellow-400';
      case 'awaiting_confirmation': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  // Format player names
  const player1Name = match.player1?.username || 'Игрок 1';
  const player2Name = match.player2?.username || 'Игрок 2';

  return (
    <Card className={`bg-gray-800 border-gray-700 ${isCompact ? 'p-2' : 'p-4'}`}>
      <CardContent className={isCompact ? 'p-2' : 'p-4'}>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className={`text-sm ${getStatusColor(match.status)}`}>
              {getStatusText(match.status)}
            </span>
            {match.status === 'completed' && match.winner_id && (
              <span className="text-xs text-gray-400">
                Победитель: {match.winner_id === match.player1_id ? player1Name : player2Name}
              </span>
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <User size={isCompact ? 16 : 20} className="text-blue-400" />
              <span className={isCompact ? 'text-sm' : 'text-md'}>{player1Name}</span>
            </div>
            
            <div className="px-3 py-1 bg-gray-700 rounded">
              <span className="font-bold">
                {formatScore(match.player1_score)}:{formatScore(match.player2_score)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className={isCompact ? 'text-sm' : 'text-md'}>{player2Name}</span>
              <User size={isCompact ? 16 : 20} className="text-red-400" />
            </div>
          </div>
          
          {showActions && match.status === 'scheduled' && (
            <div className="flex justify-center mt-2">
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate(`/matches/${match.id}`)}
                className="bg-fc-accent hover:bg-fc-accent/80"
              >
                <Sword className="mr-2 h-4 w-4" />
                Играть
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchCard;
