
import { Loader2 } from 'lucide-react';
import MatchCard from '../MatchCard';

interface CurrentMatchTabProps {
  currentMatch: any | null;
  userId: string | null;
  isLoading: boolean;
}

const CurrentMatchTab = ({ currentMatch, userId, isLoading }: CurrentMatchTabProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <>
      {currentMatch ? (
        <MatchCard match={currentMatch} userId={userId} />
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">
            Все ваши матчи завершены.
          </p>
        </div>
      )}
    </>
  );
};

export default CurrentMatchTab;
