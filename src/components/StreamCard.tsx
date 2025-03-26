
import { Play, User, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StreamCardProps {
  id: number;
  title: string;
  thumbnail: string;
  streamer: string;
  viewers?: number; // Changed to optional
  isLive: boolean;
  startTime?: string; // For upcoming streams
}

const StreamCard = ({ id, title, thumbnail, streamer, viewers = 0, isLive, startTime }: StreamCardProps) => {
  return (
    <Link to={`/streams/${id}`}>
      <div className="glass-card overflow-hidden card-hover">
        <div className="relative h-48">
          <img 
            src={thumbnail} 
            alt={title} 
            className="w-full h-full object-cover"
          />
          
          {/* Live indicator or start time */}
          <div className={`absolute top-3 left-3 text-xs font-semibold px-3 py-1 rounded-full ${
            isLive 
              ? 'bg-red-500 text-white animate-pulse' 
              : 'bg-gray-800 text-white'
          }`}>
            {isLive ? 'LIVE' : startTime}
          </div>
          
          {/* View count */}
          {isLive && viewers > 0 && (
            <div className="absolute top-3 right-3 text-xs font-semibold px-3 py-1 rounded-full bg-black bg-opacity-70 text-white flex items-center">
              <Eye size={12} className="mr-1" />
              <span>{viewers}</span>
            </div>
          )}
          
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-black bg-opacity-50 transition-opacity duration-300 hover:opacity-100">
            <div className="bg-fc-accent rounded-full p-4 text-fc-background">
              <Play size={30} fill="currentColor" />
            </div>
          </div>
        </div>
        
        <div className="p-5">
          <h3 className="text-white text-xl font-semibold mb-2 line-clamp-1">{title}</h3>
          
          <div className="flex items-center">
            <User size={16} className="text-gray-400 mr-2" />
            <span className="text-gray-400 text-sm">{streamer}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default StreamCard;
