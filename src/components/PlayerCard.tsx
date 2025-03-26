
import { Trophy, Star, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlayerCardProps {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  platform: 'ps5' | 'xbox' | 'pc';
  wins: number;
  change: number;
  rank: number;
}

const PlayerCard = ({ id, name, avatar, rating, platform, wins, change, rank }: PlayerCardProps) => {
  // Platform color and border
  const platformStyles = {
    ps5: "border-blue-500",
    xbox: "border-green-500",
    pc: "border-yellow-500"
  };
  
  // Platform icons (simplified for now)
  const platformNames = {
    ps5: "PS5",
    xbox: "Xbox",
    pc: "PC"
  };

  return (
    <Link to={`/players/${id}`}>
      <div className="glass-card p-5 card-hover">
        <div className="flex items-center">
          {/* Rank */}
          <div className="text-2xl font-bold text-gray-500 mr-4 w-8 text-center">
            {rank}
          </div>
          
          {/* Avatar with platform border */}
          <div className={`relative w-14 h-14 rounded-full border-2 ${platformStyles[platform]} overflow-hidden mr-4`}>
            <img 
              src={avatar} 
              alt={name} 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 right-0 bg-fc-background text-xs font-bold px-1 rounded-sm">
              {platformNames[platform]}
            </div>
          </div>
          
          {/* Player info */}
          <div className="flex-1">
            <h3 className="text-white font-semibold line-clamp-1">{name}</h3>
            <div className="flex items-center text-sm mt-1">
              <Star size={14} className="text-fc-accent mr-1" />
              <span className="text-fc-accent font-medium mr-3">{rating}</span>
              
              {/* Rating change */}
              {change !== 0 && (
                <div className={`flex items-center text-xs ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {change > 0 ? (
                    <ArrowUp size={12} className="mr-0.5" />
                  ) : (
                    <ArrowUp size={12} className="mr-0.5 transform rotate-180" />
                  )}
                  <span>{Math.abs(change)}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Wins */}
          <div className="text-right">
            <div className="flex items-center justify-end">
              <Trophy size={14} className="text-fc-accent mr-1" />
              <span className="text-white font-medium">{wins}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">побед</div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default PlayerCard;
