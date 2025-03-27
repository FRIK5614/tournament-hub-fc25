
import { Loader2, Circle } from 'lucide-react';
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
      
      <div className="flex justify-center items-center">
        <Button 
          className={`
            w-48 h-48 rounded-full 
            bg-fc-accent/20 border-2 border-fc-accent 
            hover:bg-fc-accent/30 transition-all duration-300
            flex flex-col items-center justify-center
            ${isLoading ? 'animate-pulse' : 'hover:scale-105'}
          `}
          onClick={onStartSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="animate-spin text-fc-accent" size={48} />
          ) : (
            <>
              <Circle className="text-fc-accent mb-2" size={48} />
              <span className="text-fc-accent font-medium">Найти турнир</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default TournamentIntro;
