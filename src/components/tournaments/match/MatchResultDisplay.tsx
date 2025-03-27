
import { Trophy } from 'lucide-react';

interface MatchResultDisplayProps {
  match: any;
  isPlayer1: boolean;
  isPlayer2: boolean;
  isAwaitingConfirmation: boolean;
}

const MatchResultDisplay = ({ match, isPlayer1, isPlayer2, isAwaitingConfirmation }: MatchResultDisplayProps) => {
  return (
    <div className="flex justify-between items-center bg-fc-background/50 p-4 rounded-lg mb-4">
      <div className="text-center flex-1">
        <div className="font-medium">{match.player1?.username || 'Игрок 1'}</div>
        {isAwaitingConfirmation && match.player1_score !== null && (
          <div className="text-2xl font-bold mt-1">{match.player1_score}</div>
        )}
        {isPlayer1 && <div className="text-xs mt-1 text-fc-accent">(Вы)</div>}
      </div>
      
      <div className="text-xl font-bold mx-4">vs</div>
      
      <div className="text-center flex-1">
        <div className="font-medium">{match.player2?.username || 'Игрок 2'}</div>
        {isAwaitingConfirmation && match.player2_score !== null && (
          <div className="text-2xl font-bold mt-1">{match.player2_score}</div>
        )}
        {isPlayer2 && <div className="text-xs mt-1 text-fc-accent">(Вы)</div>}
      </div>
    </div>
  );
};

export default MatchResultDisplay;
