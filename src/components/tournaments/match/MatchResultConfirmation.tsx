
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface MatchResultConfirmationProps {
  onConfirm: () => void;
  onReject: () => void;
  player1Score: number;
  player2Score: number;
  playerNames: {
    player1: string;
    player2: string;
  };
  isLoading: boolean;
}

const MatchResultConfirmation = ({
  onConfirm,
  onReject,
  player1Score,
  player2Score,
  playerNames,
  isLoading
}: MatchResultConfirmationProps) => {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">Подтверждение результата</h3>
        <p className="text-muted-foreground mt-1">
          Подтвердите правильность результата матча
        </p>
      </div>

      <div className="bg-gray-800 p-4 rounded-md">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">{playerNames.player1}</p>
            <p className="text-2xl font-bold text-white">{player1Score}</p>
          </div>
          <div className="text-gray-400">vs</div>
          <div className="text-right">
            <p className="font-medium">{playerNames.player2}</p>
            <p className="text-2xl font-bold text-white">{player2Score}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <Button 
          onClick={onConfirm} 
          className="bg-green-600 hover:bg-green-700"
          disabled={isLoading}
        >
          <Check className="mr-2 h-4 w-4" />
          Подтвердить
        </Button>
        <Button 
          onClick={onReject} 
          variant="outline" 
          className="border-red-500 text-red-500 hover:bg-red-500/20"
          disabled={isLoading}
        >
          <X className="mr-2 h-4 w-4" />
          Отклонить
        </Button>
      </div>
    </div>
  );
};

export default MatchResultConfirmation;
