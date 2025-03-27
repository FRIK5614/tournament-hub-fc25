
import { Link } from 'react-router-dom';
import { Calendar, Users } from 'lucide-react';

interface TournamentGridProps {
  tournaments: any[];
  loading: boolean;
  emptyMessage: string;
}

const TournamentGrid = ({ tournaments, loading, emptyMessage }: TournamentGridProps) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <span className="text-gray-400">Загрузка турниров...</span>
      </div>
    );
  }
  
  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-gray-400">{emptyMessage}</span>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {tournaments.map((tournament) => (
        <Link 
          key={tournament.id} 
          to={`/tournaments/${tournament.id}`}
          className="glass-card p-5 card-hover"
        >
          <h3 className="text-white text-lg font-semibold mb-3">{tournament.title}</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center text-gray-400">
              <Calendar size={16} className="mr-2" />
              <span>{new Date(tournament.created_at).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center text-gray-400">
              <Users size={16} className="mr-2" />
              <span>{tournament.current_participants}/{tournament.max_participants} игроков</span>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="w-full py-2 rounded-md text-center bg-fc-accent text-fc-background font-medium">
              Просмотр
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default TournamentGrid;
