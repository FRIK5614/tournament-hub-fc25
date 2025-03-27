
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import MatchResultDisplay from './match/MatchResultDisplay';
import MatchInstructions from './match/MatchInstructions';
import MatchResultSubmission from './match/MatchResultSubmission';
import MatchResultConfirmation from './match/MatchResultConfirmation';

interface MatchCardProps {
  match: any;
  userId: string | null;
}

const MatchCard = ({ match, userId }: MatchCardProps) => {
  const { toast } = useToast();
  const isPlayer1 = userId === match.player1_id;
  const isPlayer2 = userId === match.player2_id;
  const isAwaitingConfirmation = match.status === 'awaiting_confirmation';
  
  if (!isPlayer1 && !isPlayer2) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-gray-400">
          Вы не участвуете в этом матче.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card border-fc-accent p-6">
      <h3 className="text-xl font-semibold mb-4">
        {isAwaitingConfirmation ? 'Подтверждение результата' : 'Текущий матч'}
      </h3>
      
      <MatchResultDisplay 
        match={match} 
        isPlayer1={isPlayer1} 
        isPlayer2={isPlayer2} 
        isAwaitingConfirmation={isAwaitingConfirmation} 
      />
      
      <MatchInstructions 
        isAwaitingConfirmation={isAwaitingConfirmation} 
        isPlayer1={isPlayer1} 
      />
      
      {isAwaitingConfirmation && isPlayer2 ? (
        <MatchResultConfirmation match={match} />
      ) : !isAwaitingConfirmation ? (
        <MatchResultSubmission match={match} />
      ) : null}
    </div>
  );
};

export default MatchCard;
