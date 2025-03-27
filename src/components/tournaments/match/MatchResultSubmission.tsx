
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MatchResultSubmissionProps {
  playerNames: {
    player1: string;
    player2: string;
  };
  onSubmit: (player1Score: number, player2Score: number) => void;
  isLoading: boolean;
}

const MatchResultSubmission = ({
  playerNames,
  onSubmit,
  isLoading
}: MatchResultSubmissionProps) => {
  const [player1Score, setPlayer1Score] = useState<number | ''>('');
  const [player2Score, setPlayer2Score] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setError(null);
    
    // Validate inputs
    if (player1Score === '' || player2Score === '') {
      setError('Пожалуйста, укажите результат для обоих игроков');
      return;
    }
    
    if (typeof player1Score !== 'number' || typeof player2Score !== 'number') {
      setError('Счет должен быть числом');
      return;
    }
    
    if (player1Score < 0 || player2Score < 0) {
      setError('Счет не может быть отрицательным');
      return;
    }
    
    if (player1Score === player2Score) {
      setError('Результат не может быть ничейным');
      return;
    }
    
    // Submit the scores
    onSubmit(player1Score, player2Score);
  };

  const handlePlayer1ScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setPlayer1Score('');
    } else {
      setPlayer1Score(Number(value));
    }
  };

  const handlePlayer2ScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setPlayer2Score('');
    } else {
      setPlayer2Score(Number(value));
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">Отправить результат матча</h3>
        <p className="text-muted-foreground mt-1">
          Укажите финальный счет вашего матча
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label htmlFor="player1Score" className="block text-sm font-medium mb-1">
              {playerNames.player1}
            </label>
            <Input
              id="player1Score"
              type="number"
              min="0"
              value={player1Score}
              onChange={handlePlayer1ScoreChange}
              className="bg-gray-800"
              disabled={isLoading}
            />
          </div>
          
          <div className="text-center pt-4">vs</div>
          
          <div className="flex-1">
            <label htmlFor="player2Score" className="block text-sm font-medium mb-1">
              {playerNames.player2}
            </label>
            <Input
              id="player2Score"
              type="number"
              min="0"
              value={player2Score}
              onChange={handlePlayer2ScoreChange}
              className="bg-gray-800"
              disabled={isLoading}
            />
          </div>
        </div>
        
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading || player1Score === '' || player2Score === ''}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></div>
              Отправка...
            </div>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Отправить результат
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default MatchResultSubmission;
