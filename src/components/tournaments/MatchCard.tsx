
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { submitMatchResult, confirmMatchResult } from '@/services/tournament/matchService';
import { Button } from '@/components/ui/button';
import { PlusSquare, MinusSquare, CheckCircle, XCircle } from 'lucide-react';

interface MatchCardProps {
  match: any;
  userId: string | null;
}

const MatchCard = ({ match, userId }: MatchCardProps) => {
  const { toast } = useToast();
  const [player1Score, setPlayer1Score] = useState(match.player1_score || 0);
  const [player2Score, setPlayer2Score] = useState(match.player2_score || 0);
  const [submitting, setSubmitting] = useState(false);
  
  // Определяем роль текущего пользователя в матче
  const isPlayer1 = userId === match.player1_id;
  const isPlayer2 = userId === match.player2_id;
  const userInMatch = isPlayer1 || isPlayer2;
  
  // Состояние матча
  const isAwaitingConfirmation = match.status === 'awaiting_confirmation';
  const isCompleted = match.status === 'completed';
  
  // Если пользователь не участвует в матче, показываем информационное сообщение
  if (!userInMatch) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-gray-400">
          Вы не участвуете в этом матче.
        </p>
      </div>
    );
  }

  const handleScoreChange = (player: 'player1' | 'player2', change: number) => {
    if (player === 'player1') {
      setPlayer1Score(Math.max(0, player1Score + change));
    } else {
      setPlayer2Score(Math.max(0, player2Score + change));
    }
  };

  const handleSubmitResult = async () => {
    if (submitting) return;
    setSubmitting(true);
    
    try {
      // Проверяем, что сумма очков не превышает максимум для быстрого турнира
      const maxScore = 10; // Максимум 10 очков в сумме для быстрого турнира
      if (player1Score + player2Score > maxScore) {
        toast({
          title: "Неверные данные",
          description: `Сумма очков не может превышать ${maxScore} в быстром турнире`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      
      await submitMatchResult(match.id, userId!, player1Score, player2Score);
      
      toast({
        title: "Результат отправлен",
        description: isPlayer1 
          ? "Ожидается подтверждение от соперника" 
          : "Результат матча зарегистрирован",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error submitting match result:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить результат",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmResult = async (accept: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    
    try {
      await confirmMatchResult(match.id, userId!, accept);
      
      toast({
        title: accept ? "Результат подтвержден" : "Результат отклонен",
        description: accept 
          ? "Матч завершен и результаты засчитаны" 
          : "Матч возвращен в статус подготовки",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error confirming match result:", error);
      toast({
        title: "Ошибка",
        description: error.message || `Не удалось ${accept ? 'подтвердить' : 'отклонить'} результат`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Информация о результате матча
  return (
    <div className="glass-card border-fc-accent p-6">
      <h3 className="text-xl font-semibold mb-4">
        {isAwaitingConfirmation ? 'Подтверждение результата' : isCompleted ? 'Матч завершен' : 'Текущий матч'}
      </h3>
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col items-center">
          <div className={`text-center p-2 rounded ${isPlayer1 ? 'bg-fc-accent/20' : ''}`}>
            <p className="font-medium">{match.player1?.username || 'Игрок 1'}</p>
            {match.player1?.rating && <p className="text-xs text-gray-400">Рейтинг: {match.player1.rating}</p>}
          </div>
          
          {isAwaitingConfirmation || isCompleted ? (
            <div className="mt-2 text-2xl font-bold">{match.player1_score}</div>
          ) : (
            <div className="mt-2 flex items-center">
              <button 
                onClick={() => handleScoreChange('player1', -1)}
                disabled={player1Score <= 0 || isPlayer2}
                className="p-1 hover:text-gray-300 disabled:opacity-50"
              >
                <MinusSquare size={20} />
              </button>
              <span className="mx-2 text-2xl font-bold">{player1Score}</span>
              <button 
                onClick={() => handleScoreChange('player1', 1)}
                disabled={isPlayer2}
                className="p-1 hover:text-gray-300 disabled:opacity-50"
              >
                <PlusSquare size={20} />
              </button>
            </div>
          )}
        </div>
        
        <div className="text-2xl font-bold mx-4">VS</div>
        
        <div className="flex flex-col items-center">
          <div className={`text-center p-2 rounded ${isPlayer2 ? 'bg-fc-accent/20' : ''}`}>
            <p className="font-medium">{match.player2?.username || 'Игрок 2'}</p>
            {match.player2?.rating && <p className="text-xs text-gray-400">Рейтинг: {match.player2.rating}</p>}
          </div>
          
          {isAwaitingConfirmation || isCompleted ? (
            <div className="mt-2 text-2xl font-bold">{match.player2_score}</div>
          ) : (
            <div className="mt-2 flex items-center">
              <button 
                onClick={() => handleScoreChange('player2', -1)}
                disabled={player2Score <= 0 || isPlayer1}
                className="p-1 hover:text-gray-300 disabled:opacity-50"
              >
                <MinusSquare size={20} />
              </button>
              <span className="mx-2 text-2xl font-bold">{player2Score}</span>
              <button 
                onClick={() => handleScoreChange('player2', 1)}
                disabled={isPlayer1}
                className="p-1 hover:text-gray-300 disabled:opacity-50"
              >
                <PlusSquare size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {isCompleted ? (
        <div className="bg-green-500/20 text-green-400 p-3 rounded-lg text-center mb-4">
          <p className="font-medium">Матч завершен</p>
          {match.winner_id && (
            <p className="text-sm mt-1">
              Победитель: {
                match.winner_id === match.player1_id 
                  ? match.player1?.username || 'Игрок 1'
                  : match.player2?.username || 'Игрок 2'
              }
            </p>
          )}
        </div>
      ) : isAwaitingConfirmation ? (
        <div className="bg-yellow-500/20 text-yellow-400 p-3 rounded-lg text-center mb-4">
          <p className="font-medium">
            {isPlayer1 
              ? 'Ожидается подтверждение от соперника' 
              : 'Пожалуйста, подтвердите результат матча'}
          </p>
        </div>
      ) : (
        <div className="bg-blue-500/20 text-blue-400 p-3 rounded-lg text-center mb-4">
          <p className="font-medium">
            {isPlayer1 
              ? 'Введите и отправьте результат матча' 
              : 'Ожидается ввод результата первым игроком'}
          </p>
        </div>
      )}
      
      {isAwaitingConfirmation && isPlayer2 ? (
        <div className="flex gap-3 justify-center">
          <Button 
            variant="outline" 
            className="bg-destructive-foreground/10 hover:bg-destructive-foreground/20 text-destructive-foreground border-destructive-foreground/30"
            onClick={() => handleConfirmResult(false)}
            disabled={submitting}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Отклонить
          </Button>
          <Button 
            variant="outline"
            className="bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/30"
            onClick={() => handleConfirmResult(true)}
            disabled={submitting}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Подтвердить
          </Button>
        </div>
      ) : !isAwaitingConfirmation && !isCompleted ? (
        <div className="flex justify-center">
          <Button 
            variant="default"
            className="bg-fc-accent hover:bg-fc-accent/80"
            onClick={handleSubmitResult}
            disabled={submitting || (isPlayer2 && !match.player1_score)}
          >
            {submitting ? 'Отправка...' : 'Отправить результат'}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default MatchCard;
