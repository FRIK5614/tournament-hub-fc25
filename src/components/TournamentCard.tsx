
import { Calendar, Users, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TournamentCardProps {
  id: number;
  title: string;
  image: string;
  date: string;
  players: string;
  prize: string;
  status: 'active' | 'upcoming' | 'finished';
}

const TournamentCard = ({ id, title, image, date, players, prize, status }: TournamentCardProps) => {
  return (
    <Link to={`/tournaments/${id}`}>
      <div className="glass-card overflow-hidden card-hover">
        <div className="relative h-48">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover"
          />
          {/* Status badge */}
          <div className={`absolute top-3 right-3 text-xs font-semibold px-3 py-1 rounded-full ${
            status === 'active' 
              ? 'bg-fc-accent text-fc-background animate-pulse-green' 
              : status === 'upcoming' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-600 text-white'
          }`}>
            {status === 'active' ? 'Активный' : status === 'upcoming' ? 'Скоро' : 'Завершен'}
          </div>
        </div>
        
        <div className="p-5">
          <h3 className="text-white text-xl font-semibold mb-3 line-clamp-1">{title}</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center text-gray-400">
              <Calendar size={16} className="mr-2" />
              <span>{date}</span>
            </div>
            
            <div className="flex items-center text-gray-400">
              <Users size={16} className="mr-2" />
              <span>{players}</span>
            </div>
            
            <div className="flex items-center text-fc-accent font-medium">
              <Trophy size={16} className="mr-2" />
              <span>{prize}</span>
            </div>
          </div>
          
          <div className="mt-4">
            <button className={`w-full py-2 rounded-md transition-colors duration-300 ${
              status === 'active' 
                ? 'bg-fc-accent text-fc-background hover:bg-fc-accent-muted' 
                : status === 'upcoming' 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}>
              {status === 'active' ? 'Присоединиться' : status === 'upcoming' ? 'Записаться' : 'Результаты'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default TournamentCard;
