
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import TournamentCard from './TournamentCard';

// Sample tournament data
const tournamentData = [
  {
    id: 1,
    title: 'Быстрый турнир #247',
    image: '/tournament1.jpg',
    date: 'Сейчас',
    players: '2/4 игроков',
    prize: '1000₽',
    status: 'active' as const
  },
  {
    id: 2,
    title: 'Профессиональная лига FC25',
    image: '/tournament2.jpg',
    date: 'Через 2 часа',
    players: '12/16 игроков',
    prize: '10000₽',
    status: 'upcoming' as const
  },
  {
    id: 3,
    title: 'Еженедельный кубок',
    image: '/tournament3.jpg',
    date: 'Сегодня, 21:00',
    players: '8/8 игроков',
    prize: '5000₽',
    status: 'upcoming' as const
  },
  {
    id: 4,
    title: 'Турнир новичков',
    image: '/tournament1.jpg',
    date: 'Сейчас',
    players: '3/4 игроков',
    prize: '500₽',
    status: 'active' as const
  }
];

const ActiveTournaments = () => {
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

    observer.observe(document.getElementById('tournaments-section')!);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="tournaments-section" 
      className="py-20 px-6 md:px-12"
    >
      <div className="max-w-7xl mx-auto">
        <div className={`transition-all duration-700 ease-out transform ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <h2 className="section-title">Активные турниры</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {tournamentData.map((tournament, index) => (
              <div 
                key={tournament.id}
                className={`transition-all duration-700 ease-out transform delay-${index * 100} ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <TournamentCard {...tournament} />
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/tournaments" className="btn-outline inline-flex items-center group">
              Все турниры
              <ArrowRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ActiveTournaments;
