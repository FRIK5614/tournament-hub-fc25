
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Users, Trophy, ArrowLeft, Clock, MapPin, Tag, Shield, Activity } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// Пример данных о турнирах
const tournamentsData = [
  {
    id: 1,
    title: 'FC25 Зимний Кубок 2025',
    description: 'Ежегодный турнир среди лучших игроков FC25 с призовым фондом и квалификацией на международные соревнования.',
    image: '/tournament1.jpg',
    date: '15 января - 30 января 2025',
    location: 'Онлайн + LAN-финал в Москве',
    players: '128 участников',
    prize: '₽1,000,000',
    status: 'active' as const,
    format: 'Групповой этап + плей-офф',
    category: 'Профессиональный',
    organizer: 'FC Esports Association',
    participants: [
      { id: 1, name: 'Александр "ProGamer" Иванов', avatar: '/player1.jpg', wins: 12, losses: 2, rank: 1 },
      { id: 2, name: 'Дмитрий "DM" Петров', avatar: '/player2.jpg', wins: 10, losses: 3, rank: 3 },
      { id: 3, name: 'Иван "Sniper" Сидоров', avatar: '/player3.jpg', wins: 9, losses: 5, rank: 7 },
      // Другие участники
    ],
    brackets: [
      {
        round: 'Четвертьфинал',
        matches: [
          { id: 1, player1: 'Александр "ProGamer" Иванов', player2: 'Иван "Sniper" Сидоров', score: '3:1', time: '25.01.2025, 15:00' },
          { id: 2, player1: 'Дмитрий "DM" Петров', player2: 'Сергей "Cobra" Козлов', score: '3:2', time: '25.01.2025, 18:00' },
          // Другие матчи
        ]
      },
      // Другие раунды
    ]
  },
  // Другие турниры
];

const TournamentDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState(tournamentsData.find(t => t.id === Number(id)));
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'brackets'>('overview');
  
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    // В реальном приложении здесь был бы запрос к API для получения данных о турнире
    const tournamentData = tournamentsData.find(t => t.id === Number(id));
    setTournament(tournamentData);
  }, [id]);
  
  if (!tournament) {
    return (
      <div className="min-h-screen bg-fc-background text-white">
        <Navbar />
        <div className="pt-24 pb-16 px-6 md:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="glass-card p-12 text-center">
              <h2 className="text-2xl font-bold mb-4">Турнир не найден</h2>
              <p className="text-gray-400 mb-6">Запрашиваемый турнир не существует или был удален.</p>
              <Link to="/tournaments" className="btn-primary">
                Вернуться к списку турниров
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      {/* Hero banner */}
      <div className="relative h-80 md:h-96">
        <div className="absolute inset-0 bg-black/50 z-10"></div>
        <img 
          src={tournament.image} 
          alt={tournament.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex items-end">
          <div className="container mx-auto px-6 md:px-12 pb-12 pt-24">
            <Link to="/tournaments" className="flex items-center text-gray-300 hover:text-white mb-4 group">
              <ArrowLeft size={20} className="mr-2 transition-transform group-hover:-translate-x-1" />
              Вернуться к турнирам
            </Link>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
              tournament.status === 'active' 
                ? 'bg-fc-accent text-fc-background animate-pulse-green' 
                : tournament.status === 'upcoming' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-600 text-white'
            }`}>
              {tournament.status === 'active' ? 'Активный' : tournament.status === 'upcoming' ? 'Скоро' : 'Завершен'}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">{tournament.title}</h1>
          </div>
        </div>
      </div>
      
      {/* Tournament content */}
      <div className="container mx-auto px-6 md:px-12 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="mb-6 border-b border-fc-muted">
              <div className="flex overflow-x-auto no-scrollbar">
                <button
                  className={`px-4 py-2 font-medium whitespace-nowrap ${
                    activeTab === 'overview' 
                      ? 'text-fc-accent border-b-2 border-fc-accent' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('overview')}
                >
                  Обзор
                </button>
                <button
                  className={`px-4 py-2 font-medium whitespace-nowrap ${
                    activeTab === 'participants' 
                      ? 'text-fc-accent border-b-2 border-fc-accent' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('participants')}
                >
                  Участники
                </button>
                <button
                  className={`px-4 py-2 font-medium whitespace-nowrap ${
                    activeTab === 'brackets' 
                      ? 'text-fc-accent border-b-2 border-fc-accent' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('brackets')}
                >
                  Сетка турнира
                </button>
              </div>
            </div>
            
            {/* Tab content */}
            <div className="glass-card p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-4">О турнире</h2>
                  <p className="text-gray-300 leading-relaxed">{tournament.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    <div className="glass-card bg-fc-background/30 p-4">
                      <h3 className="font-semibold mb-3 flex items-center">
                        <Tag className="mr-2 text-fc-accent" size={18} />
                        Категория
                      </h3>
                      <p>{tournament.category}</p>
                    </div>
                    
                    <div className="glass-card bg-fc-background/30 p-4">
                      <h3 className="font-semibold mb-3 flex items-center">
                        <Shield className="mr-2 text-fc-accent" size={18} />
                        Организатор
                      </h3>
                      <p>{tournament.organizer}</p>
                    </div>
                    
                    <div className="glass-card bg-fc-background/30 p-4">
                      <h3 className="font-semibold mb-3 flex items-center">
                        <Activity className="mr-2 text-fc-accent" size={18} />
                        Формат
                      </h3>
                      <p>{tournament.format}</p>
                    </div>
                    
                    <div className="glass-card bg-fc-background/30 p-4">
                      <h3 className="font-semibold mb-3 flex items-center">
                        <Trophy className="mr-2 text-fc-accent" size={18} />
                        Призовой фонд
                      </h3>
                      <p className="text-fc-accent font-semibold">{tournament.prize}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'participants' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Участники турнира</h2>
                  <div className="space-y-4">
                    {tournament.participants.map(participant => (
                      <div key={participant.id} className="flex items-center justify-between p-3 glass-card bg-fc-background/30 hover:bg-fc-background/50 transition-colors">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full overflow-hidden mr-4">
                            <img 
                              src={participant.avatar} 
                              alt={participant.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <h3 className="font-medium">{participant.name}</h3>
                            <p className="text-xs text-gray-400">Рейтинг: #{participant.rank}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            <span className="text-green-500">{participant.wins}W</span>
                            {' / '}
                            <span className="text-red-500">{participant.losses}L</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {activeTab === 'brackets' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Сетка турнира</h2>
                  {tournament.brackets.map(round => (
                    <div key={round.round} className="mb-8">
                      <h3 className="text-xl font-medium mb-4">{round.round}</h3>
                      <div className="space-y-4">
                        {round.matches.map(match => (
                          <div key={match.id} className="glass-card bg-fc-background/30 p-4">
                            <div className="flex justify-between items-center mb-3">
                              <p className="text-sm text-gray-400 flex items-center">
                                <Clock size={14} className="mr-1" />
                                {match.time}
                              </p>
                              <p className="text-sm font-semibold bg-fc-accent/20 text-fc-accent px-2 py-1 rounded">
                                {match.score}
                              </p>
                            </div>
                            <div className="flex flex-col space-y-3">
                              <div className="flex justify-between items-center">
                                <p className="font-medium">{match.player1}</p>
                                <p className="font-bold">{match.score.split(':')[0]}</p>
                              </div>
                              <div className="flex justify-between items-center">
                                <p className="font-medium">{match.player2}</p>
                                <p className="font-bold">{match.score.split(':')[1]}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="text-xl font-bold mb-4">Информация</h3>
              <div className="space-y-4">
                <div className="flex">
                  <Calendar size={20} className="text-fc-accent mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Даты проведения</p>
                    <p className="text-gray-400">{tournament.date}</p>
                  </div>
                </div>
                
                <div className="flex">
                  <MapPin size={20} className="text-fc-accent mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Место проведения</p>
                    <p className="text-gray-400">{tournament.location}</p>
                  </div>
                </div>
                
                <div className="flex">
                  <Users size={20} className="text-fc-accent mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Участники</p>
                    <p className="text-gray-400">{tournament.players}</p>
                  </div>
                </div>
                
                <div className="flex">
                  <Trophy size={20} className="text-fc-accent mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Призовой фонд</p>
                    <p className="text-fc-accent font-semibold">{tournament.prize}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {tournament.status === 'active' && (
              <button className="w-full py-3 bg-fc-accent text-fc-background font-semibold rounded-lg hover:bg-fc-accent/90 transition-colors">
                Присоединиться к турниру
              </button>
            )}
            
            {tournament.status === 'upcoming' && (
              <button className="w-full py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors">
                Записаться на турнир
              </button>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default TournamentDetails;
