
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TournamentCard from '@/components/TournamentCard';
import { Search, Filter } from 'lucide-react';

// Extended sample tournament data
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
  },
  {
    id: 5,
    title: 'Кубок FC25 Masters',
    image: '/tournament2.jpg',
    date: 'Завтра, 19:00',
    players: '6/32 игроков',
    prize: '15000₽',
    status: 'upcoming' as const
  },
  {
    id: 6,
    title: 'Турнир выходного дня',
    image: '/tournament3.jpg',
    date: 'Суббота, 12:00',
    players: '0/8 игроков',
    prize: '3000₽',
    status: 'upcoming' as const
  },
  {
    id: 7,
    title: 'Ночная лига FC25',
    image: '/tournament1.jpg',
    date: 'Вчера',
    players: '4/4 игроков',
    prize: '2000₽',
    status: 'finished' as const
  },
  {
    id: 8,
    title: 'Международный турнир',
    image: '/tournament2.jpg',
    date: '12.09.2023',
    players: '32/32 игроков',
    prize: '25000₽',
    status: 'finished' as const
  }
];

const TournamentsPage = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'upcoming' | 'finished'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);
  
  // Filter tournaments based on active filter and search query
  const filteredTournaments = tournamentData.filter(tournament => {
    const matchesFilter = 
      activeFilter === 'all' || 
      tournament.status === activeFilter;
      
    const matchesSearch = 
      tournament.title.toLowerCase().includes(searchQuery.toLowerCase());
      
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      {/* Page header */}
      <div className="pt-24 pb-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold">Турниры FC25</h1>
          <p className="text-gray-400 mt-2">Найдите турнир и начните свой путь к победе</p>
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="px-6 md:px-12 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search bar */}
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Поиск турниров..."
                  className="w-full bg-fc-background border border-fc-muted rounded-lg py-2 px-4 pl-10 text-white focus:outline-none focus:border-fc-accent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} className="text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
              
              {/* Filters */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 flex items-center">
                  <Filter size={16} className="mr-1" />
                  Фильтр:
                </span>
                <button
                  className={`px-3 py-1 rounded-full transition-colors ${
                    activeFilter === 'all' 
                      ? 'bg-fc-accent text-fc-background' 
                      : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                  }`}
                  onClick={() => setActiveFilter('all')}
                >
                  Все
                </button>
                <button
                  className={`px-3 py-1 rounded-full transition-colors ${
                    activeFilter === 'active' 
                      ? 'bg-fc-accent text-fc-background' 
                      : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                  }`}
                  onClick={() => setActiveFilter('active')}
                >
                  Активные
                </button>
                <button
                  className={`px-3 py-1 rounded-full transition-colors ${
                    activeFilter === 'upcoming' 
                      ? 'bg-fc-accent text-fc-background' 
                      : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                  }`}
                  onClick={() => setActiveFilter('upcoming')}
                >
                  Предстоящие
                </button>
                <button
                  className={`px-3 py-1 rounded-full transition-colors ${
                    activeFilter === 'finished' 
                      ? 'bg-fc-accent text-fc-background' 
                      : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                  }`}
                  onClick={() => setActiveFilter('finished')}
                >
                  Завершенные
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tournaments grid */}
      <div className="px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          {filteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
              {filteredTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} {...tournament} />
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center animate-fade-in">
              <h3 className="text-xl font-semibold mb-2">Турниры не найдены</h3>
              <p className="text-gray-400">
                По вашему запросу не найдено ни одного турнира. Попробуйте изменить параметры поиска.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default TournamentsPage;
