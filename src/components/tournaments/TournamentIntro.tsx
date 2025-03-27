
interface TournamentIntroProps {
  onStartSearch: () => void;
  isLoading: boolean;
}

import { Loader2 } from 'lucide-react';

const TournamentIntro = ({ onStartSearch, isLoading }: TournamentIntroProps) => {
  return (
    <div className="text-center">
      <p className="text-gray-300 mb-4">
        Участвуйте в быстрых турнирах на 4 игрока, где каждый играет с каждым.
        Победы повышают ваш рейтинг для участия в долгосрочных турнирах.
      </p>
      
      <button 
        className="btn-primary"
        onClick={onStartSearch}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="animate-spin mr-2" size={18} />
        ) : null}
        Найти турнир
      </button>
    </div>
  );
};

export default TournamentIntro;
