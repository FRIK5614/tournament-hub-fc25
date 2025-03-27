
import { Trophy } from 'lucide-react';

const TournamentInfo = () => {
  return (
    <div className="glass-card p-6">
      <h3 className="text-xl font-semibold mb-6">Как работают турниры</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-fc-background/50 rounded-lg p-4">
          <h4 className="font-medium mb-2 flex items-center">
            <Trophy className="text-fc-accent mr-2" size={18} />
            Быстрые турниры
          </h4>
          <p className="text-sm text-gray-300">
            Быстрые турниры на 4 игрока, где каждый играет с каждым. 
            Победы повышают ваш рейтинг для участия в долгосрочных турнирах.
          </p>
        </div>
        
        <div className="bg-fc-background/50 rounded-lg p-4">
          <h4 className="font-medium mb-2 flex items-center">
            <Trophy className="text-blue-500 mr-2" size={18} />
            Долгосрочные турниры
          </h4>
          <p className="text-sm text-gray-300">
            Три уровня ежемесячных турниров: Лига конференций, Лига Европы и Лига чемпионов.
            Турниры с призовым фондом и жеребьевкой по правилам УЕФА.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TournamentInfo;
