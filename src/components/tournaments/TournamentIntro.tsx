
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TournamentIntroProps {
  onStartSearch: () => void;
  isLoading: boolean;
}

const TournamentIntro = ({ onStartSearch, isLoading }: TournamentIntroProps) => {
  return (
    <div className="text-center">
      <p className="text-gray-300 mb-4">
        Участвуйте в быстрых турнирах на 4 игрока, где каждый играет с каждым.
        Победы повышают ваш рейтинг для участия в долгосрочных турнирах.
      </p>
      
      <Button 
        className="bg-green-600 hover:bg-green-700 w-full"
        onClick={onStartSearch}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="animate-spin mr-2" size={18} />
        ) : null}
        Найти турнир
      </Button>
    </div>
  );
};

export default TournamentIntro;
