
import { Trophy, Medal } from 'lucide-react';

interface TournamentStandingsProps {
  standings: any[];
}

const TournamentStandings = ({ standings }: TournamentStandingsProps) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Турнирная таблица</h3>
      
      {standings.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-400">Данные о турнирной таблице отсутствуют.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left">Место</th>
                <th className="px-4 py-3 text-left">Игрок</th>
                <th className="px-4 py-3 text-center">Очки</th>
              </tr>
            </thead>
            <tbody>
              {[...standings]
                .sort((a, b) => b.points - a.points)
                .map((player, index) => (
                  <tr key={player.id} className="border-b border-gray-800">
                    <td className="px-4 py-3">
                      {index === 0 ? (
                        <div className="flex items-center">
                          <Trophy className="text-yellow-500 mr-1" size={16} />
                          <span>1</span>
                        </div>
                      ) : index === 1 ? (
                        <div className="flex items-center">
                          <Medal className="text-gray-400 mr-1" size={16} />
                          <span>2</span>
                        </div>
                      ) : index === 2 ? (
                        <div className="flex items-center">
                          <Medal className="text-amber-700 mr-1" size={16} />
                          <span>3</span>
                        </div>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {player.user?.avatar_url && (
                          <img 
                            src={player.user.avatar_url} 
                            alt={player.user?.username} 
                            className="w-6 h-6 rounded-full mr-2"
                          />
                        )}
                        <span>{player.user?.username || 'Неизвестный игрок'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {player.points}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TournamentStandings;
