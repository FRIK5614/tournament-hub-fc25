
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
        className="bg-fc-accent hover:bg-fc-accent/80 transition-colors w-full py-6 text-lg font-medium"
        onClick={onStartSearch}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Поиск...
          </>
        ) : "Найти турнир"}
      </Button>
    </div>
  );
};

export default TournamentIntro;
