
import { Timer } from 'lucide-react';

interface MatchInstructionsProps {
  isAwaitingConfirmation: boolean;
  isPlayer1: boolean;
}

const MatchInstructions = ({ isAwaitingConfirmation, isPlayer1 }: MatchInstructionsProps) => {
  if (isAwaitingConfirmation && isPlayer1) {
    return (
      <div className="text-center py-4">
        <p className="mb-4">Ожидание подтверждения результата от соперника.</p>
      </div>
    );
  }
  
  if (!isAwaitingConfirmation) {
    return (
      <div className="mb-6">
        <p className="text-gray-300 mb-4">
          Свяжитесь с соперником через чат, договоритесь о матче в игре, а затем отправьте результат.
          Не забудьте сделать скриншот результата для подтверждения.
        </p>
        
        <div className="flex justify-center items-center mb-4">
          <Timer className="text-yellow-500 mr-2" />
          <span className="text-sm">У вас есть 20 минут на проведение матча</span>
        </div>
      </div>
    );
  }
  
  return null;
};

export default MatchInstructions;
