
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PlayerCard from './PlayerCard';

// Sample player data
const playerData = [
  {
    id: 1,
    name: 'AlexMaster',
    avatar: '/player1.jpg',
    rating: 2145,
    platform: 'ps5' as const,
    wins: 124,
    change: 15,
    rank: 1
  },
  {
    id: 2,
    name: 'ProGamer2000',
    avatar: '/player2.jpg',
    rating: 2089,
    platform: 'xbox' as const,
    wins: 118,
    change: -5,
    rank: 2
  },
  {
    id: 3,
    name: 'FC_Legend',
    avatar: '/player3.jpg',
    rating: 2067,
    platform: 'pc' as const,
    wins: 112,
    change: 8,
    rank: 3
  },
  {
    id: 4,
    name: 'KingOfFC',
    avatar: '/player1.jpg',
    rating: 2031,
    platform: 'ps5' as const,
    wins: 109,
    change: 0,
    rank: 4
  }
];

const TopPlayers = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(document.getElementById('players-section')!);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="players-section" 
      className="py-20 px-6 md:px-12 bg-fc-background/50"
    >
      <div className="max-w-7xl mx-auto">
        <div className={`transition-all duration-700 ease-out transform ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <h2 className="section-title">Лучшие игроки</h2>
          
          <div className="mt-12 space-y-4">
            {playerData.map((player, index) => (
              <div 
                key={player.id}
                className={`transition-all duration-700 ease-out transform delay-${index * 100} ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <PlayerCard {...player} />
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/rankings" className="btn-outline inline-flex items-center group">
              Полный рейтинг
              <ArrowRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TopPlayers;
