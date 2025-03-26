
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StreamCard from '@/components/StreamCard';
import { Search, Filter } from 'lucide-react';

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

const StreamsPage = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);
  
  // Filter streams based on active filter and search query
  const filteredStreams = streamData.filter(stream => {
    const matchesFilter = 
      activeFilter === 'all' || 
      (activeFilter === 'live' && stream.isLive) ||
      (activeFilter === 'upcoming' && !stream.isLive);
      
    const matchesSearch = 
      stream.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stream.streamer.toLowerCase().includes(searchQuery.toLowerCase());
      
    return matchesFilter && matchesSearch;
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
      
      {/* Search and filters */}
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
          </div>
        </div>
      </div>
      
      {/* Streams grid */}
      <div className="px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          {filteredStreams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {filteredStreams.map((stream) => (
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
