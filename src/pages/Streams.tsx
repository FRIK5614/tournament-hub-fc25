
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StreamCard from '@/components/StreamCard';
import { Search, Filter, ArrowUpDown, SortAsc, Users, Clock, AlignLeft } from 'lucide-react';

// Sample stream data
const streamData = [
  {
    id: 1,
    title: 'FC25 Финал лиги - Спартак vs ЦСКА',
    thumbnail: '/stream1.jpg',
    streamer: 'ProGamer25',
    viewers: 1245,
    isLive: true
  },
  {
    id: 2,
    title: 'Турнир FC Champions - Групповой этап',
    thumbnail: '/stream2.jpg',
    streamer: 'FC_Masters',
    viewers: 876,
    isLive: true
  },
  {
    id: 3,
    title: 'Обучение новичков - Базовые техники игры',
    thumbnail: '/stream3.jpg',
    streamer: 'Coach_Sergey',
    viewers: 321,
    isLive: true
  },
  {
    id: 4,
    title: 'Разбор тактик профессиональных игроков',
    thumbnail: '/stream4.jpg',
    streamer: 'TacticsMaster',
    startTime: 'Сегодня, 20:00',
    isLive: false
  },
  {
    id: 5,
    title: 'Еженедельный турнир FC25 - Отборочные',
    thumbnail: '/stream5.jpg',
    streamer: 'FC_Official',
    startTime: 'Завтра, 18:00',
    isLive: false
  },
  {
    id: 6,
    title: 'Сражение звёзд FC25',
    thumbnail: '/stream6.jpg',
    streamer: 'GameTV',
    startTime: 'Суббота, 19:30',
    isLive: false
  }
];

type SortOption = 'viewers' | 'startTime' | 'streamer';

const StreamsPage = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('viewers');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);
  
  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Change sort option
  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      toggleSortDirection();
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
  };
  
  // Filter and sort streams based on active filter, search query, and sort options
  const filteredAndSortedStreams = streamData
    .filter(stream => {
      const matchesFilter = 
        activeFilter === 'all' || 
        (activeFilter === 'live' && stream.isLive) ||
        (activeFilter === 'upcoming' && !stream.isLive);
        
      const matchesSearch = 
        stream.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stream.streamer.toLowerCase().includes(searchQuery.toLowerCase());
        
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'viewers') {
        const viewersA = a.viewers || 0;
        const viewersB = b.viewers || 0;
        return sortDirection === 'asc' ? viewersA - viewersB : viewersB - viewersA;
      } 
      
      if (sortBy === 'startTime') {
        // For live streams, they come first (or last, depending on sort direction)
        if (a.isLive && !b.isLive) return sortDirection === 'asc' ? 1 : -1;
        if (!a.isLive && b.isLive) return sortDirection === 'asc' ? -1 : 1;
        
        // If both are upcoming, sort by startTime
        if (!a.isLive && !b.isLive) {
          return sortDirection === 'asc' 
            ? (a.startTime || '').localeCompare(b.startTime || '')
            : (b.startTime || '').localeCompare(a.startTime || '');
        }
        
        // If both are live, leave order as is
        return 0;
      }
      
      if (sortBy === 'streamer') {
        return sortDirection === 'asc'
          ? a.streamer.localeCompare(b.streamer)
          : b.streamer.localeCompare(a.streamer);
      }
      
      return 0;
    });

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      {/* Page header */}
      <div className="pt-24 pb-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold">Трансляции FC25</h1>
          <p className="text-gray-400 mt-2">Смотрите прямые трансляции матчей и турниров</p>
        </div>
      </div>
      
      {/* Search, filters and sorting */}
      <div className="px-6 md:px-12 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search bar */}
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Поиск трансляций..."
                  className="w-full bg-fc-background border border-fc-muted rounded-lg py-2 px-4 pl-10 text-white focus:outline-none focus:border-fc-accent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} className="text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
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
                    activeFilter === 'live' 
                      ? 'bg-fc-accent text-fc-background' 
                      : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                  }`}
                  onClick={() => setActiveFilter('live')}
                >
                  Сейчас
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
              </div>
            </div>
            
            {/* Sorting options */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-400 flex items-center">
                <ArrowUpDown size={16} className="mr-1" />
                Сортировка:
              </span>
              <button
                className={`flex items-center px-3 py-1 rounded-full transition-colors ${
                  sortBy === 'viewers' 
                    ? 'bg-fc-accent text-fc-background' 
                    : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                }`}
                onClick={() => handleSortChange('viewers')}
              >
                <Users size={14} className="mr-1" />
                Зрители
                {sortBy === 'viewers' && (
                  <SortAsc size={14} className={`ml-1 transition-transform ${
                    sortDirection === 'desc' ? 'rotate-180' : ''
                  }`} />
                )}
              </button>
              <button
                className={`flex items-center px-3 py-1 rounded-full transition-colors ${
                  sortBy === 'startTime' 
                    ? 'bg-fc-accent text-fc-background' 
                    : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                }`}
                onClick={() => handleSortChange('startTime')}
              >
                <Clock size={14} className="mr-1" />
                Время
                {sortBy === 'startTime' && (
                  <SortAsc size={14} className={`ml-1 transition-transform ${
                    sortDirection === 'desc' ? 'rotate-180' : ''
                  }`} />
                )}
              </button>
              <button
                className={`flex items-center px-3 py-1 rounded-full transition-colors ${
                  sortBy === 'streamer' 
                    ? 'bg-fc-accent text-fc-background' 
                    : 'bg-fc-muted text-white hover:bg-fc-muted/80'
                }`}
                onClick={() => handleSortChange('streamer')}
              >
                <AlignLeft size={14} className="mr-1" />
                Стример
                {sortBy === 'streamer' && (
                  <SortAsc size={14} className={`ml-1 transition-transform ${
                    sortDirection === 'desc' ? 'rotate-180' : ''
                  }`} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Streams grid */}
      <div className="px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          {filteredAndSortedStreams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {filteredAndSortedStreams.map((stream) => (
                <StreamCard key={stream.id} {...stream} />
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center animate-fade-in">
              <h3 className="text-xl font-semibold mb-2">Трансляции не найдены</h3>
              <p className="text-gray-400">
                По вашему запросу не найдено ни одной трансляции. Попробуйте изменить параметры поиска.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default StreamsPage;
