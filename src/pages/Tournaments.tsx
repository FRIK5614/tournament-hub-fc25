
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import QuickTournamentSearch from '@/components/tournaments/QuickTournamentSearch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";

const Tournaments = () => {
  const [activeTournaments, setActiveTournaments] = useState<any[]>([]);
  const [completedTournaments, setCompletedTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    
    const fetchTournaments = async () => {
      try {
        // Fetch active tournaments
        const { data: active } = await supabase
          .from('tournaments')
          .select('*')
          .eq('status', 'active')
          .eq('tournament_format', 'quick')
          .order('created_at', { ascending: false })
          .limit(12);
          
        setActiveTournaments(active || []);
        
        // Fetch completed tournaments
        const { data: completed } = await supabase
          .from('tournaments')
          .select('*')
          .eq('status', 'completed')
          .eq('tournament_format', 'quick')
          .order('created_at', { ascending: false })
          .limit(12);
          
        setCompletedTournaments(completed || []);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching tournaments:', error);
        setLoading(false);
      }
    };
    
    checkAuth();
    fetchTournaments();
  }, []);

  const redirectToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold">Турниры</h1>
            
            <Link 
              to="/long-term-tournaments" 
              className="btn-outline inline-flex items-center group"
            >
              Долгосрочные турниры
              <ArrowRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-1">
              {isLoggedIn ? (
                <QuickTournamentSearch />
              ) : (
                <div className="glass-card p-6">
                  <h3 className="text-xl font-semibold mb-4">Быстрый турнир</h3>
                  
                  <p className="text-gray-300 mb-6">
                    Для участия в быстрых турнирах необходимо войти в аккаунт.
                    Зарегистрируйтесь или войдите, чтобы начать играть.
                  </p>
                  
                  <button 
                    className="btn-primary w-full"
                    onClick={redirectToLogin}
                  >
                    Войти / Зарегистрироваться
                  </button>
                </div>
              )}
            </div>
            
            <div className="lg:col-span-2">
              <div className="glass-card p-6">
                <h3 className="text-xl font-semibold mb-6">Как работают турниры</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-fc-background/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center">
                      <Trophy className="text-fc-accent mr-2" size={18} />
                      Быстрые турниры
                    </h4>
                    <p className="text-sm text-gray-300">
                      Быстрые турниры на 4 игрока, где каждый играет с каждым. 
                      Победы повышают ваш рейтинг для участия в долгосрочных турнирах.
                    </p>
                  </div>
                  
                  <div className="bg-fc-background/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center">
                      <Trophy className="text-blue-500 mr-2" size={18} />
                      Долгосрочные турниры
                    </h4>
                    <p className="text-sm text-gray-300">
                      Три уровня ежемесячных турниров: Лига конференций, Лига Европы и Лига чемпионов.
                      Турниры с призовым фондом и жеребьевкой по правилам УЕФА.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-10">
            <Tabs defaultValue="active">
              <TabsList className="mb-6">
                <TabsTrigger value="active">Активные турниры</TabsTrigger>
                <TabsTrigger value="completed">Завершенные турниры</TabsTrigger>
              </TabsList>
              
              <TabsContent value="active">
                {loading ? (
                  <div className="text-center py-12">
                    <span className="text-gray-400">Загрузка турниров...</span>
                  </div>
                ) : activeTournaments.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="text-gray-400">Сейчас нет активных турниров.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {activeTournaments.map((tournament) => (
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
                )}
              </TabsContent>
              
              <TabsContent value="completed">
                {loading ? (
                  <div className="text-center py-12">
                    <span className="text-gray-400">Загрузка турниров...</span>
                  </div>
                ) : completedTournaments.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="text-gray-400">Нет завершенных турниров.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {completedTournaments.map((tournament) => (
                      <Link 
                        key={tournament.id} 
                        to={`/tournaments/${tournament.id}`}
                        className="glass-card p-5 card-hover opacity-80 hover:opacity-100"
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
                          <div className="w-full py-2 rounded-md text-center bg-gray-700 text-white font-medium">
                            Результаты
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Tournaments;
