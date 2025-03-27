
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getLongTermTournaments, registerForLongTermTournament } from '@/services/tournamentService';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Calendar, Users, Trophy, Star, CheckCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

const LongTermTournaments = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [registeredTournaments, setRegisteredTournaments] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id || null;
        setUserId(uid);
        
        if (uid) {
          // Get user rating
          const { data: profileData } = await supabase
            .from('profiles')
            .select('rating')
            .eq('id', uid)
            .single();
            
          if (profileData) {
            setUserRating(profileData.rating);
          }
          
          // Get user's registered tournaments
          const { data: participationData } = await supabase
            .from('tournament_participants')
            .select('tournament_id')
            .eq('user_id', uid);
            
          if (participationData) {
            setRegisteredTournaments(participationData.map(p => p.tournament_id));
          }
        }
        
        // Get long-term tournaments
        const tournamentsData = await getLongTermTournaments();
        setTournaments(tournamentsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching tournaments:', error);
        setLoading(false);
      }
    };
    
    fetchTournaments();
  }, []);

  const handleRegister = async (tournamentId: string) => {
    try {
      if (!userId) {
        toast({
          title: "Требуется авторизация",
          description: "Для регистрации на турнир необходимо войти в аккаунт",
          variant: "destructive",
        });
        return;
      }
      
      await registerForLongTermTournament(tournamentId);
      
      setRegisteredTournaments(prev => [...prev, tournamentId]);
      
      toast({
        title: "Успешная регистрация",
        description: "Вы зарегистрированы на турнир",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка регистрации",
        description: error.message || "Не удалось зарегистрироваться на турнир",
        variant: "destructive",
      });
    }
  };

  const getTournamentTypeInfo = (format: string) => {
    switch (format) {
      case 'conference':
        return {
          name: 'Лига конференций',
          color: 'text-green-500',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500'
        };
      case 'europa':
        return {
          name: 'Лига Европы',
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/20',
          borderColor: 'border-orange-500'
        };
      case 'champions':
        return {
          name: 'Лига чемпионов',
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500'
        };
      default:
        return {
          name: 'Турнир',
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/20',
          borderColor: 'border-purple-500'
        };
    }
  };

  const isRegistrationOpen = (tournament: any) => {
    if (tournament.status !== 'registration') return false;
    if (tournament.current_participants >= tournament.max_participants) return false;
    return true;
  };

  const canRegister = (tournament: any) => {
    if (!isRegistrationOpen(tournament)) return false;
    if (registeredTournaments.includes(tournament.id)) return false;
    if (tournament.qualification_rating && userRating && userRating < tournament.qualification_rating) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Долгосрочные турниры</h1>
          
          <div className="mb-10">
            <p className="text-gray-300 max-w-3xl mb-6">
              Долгосрочные турниры проводятся раз в месяц с призовым фондом. Для участия в них необходимо набрать 
              определенный рейтинг в быстрых турнирах. Существует три уровня турниров, по аналогии с турнирами УЕФА:
              Лига конференций, Лига Европы и Лига чемпионов.
            </p>
            
            {userRating && (
              <div className="glass-card p-4 mb-6 inline-flex items-center">
                <Star className="text-yellow-500 mr-2" />
                <span>Ваш текущий рейтинг: <strong>{userRating}</strong></span>
              </div>
            )}
            
            {!userId && (
              <div className="bg-yellow-500/20 border border-yellow-500 rounded p-4 mb-6">
                <p>Для участия в турнирах необходимо войти в аккаунт.</p>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <span className="text-gray-400">Загрузка турниров...</span>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-gray-400">В настоящее время нет активных долгосрочных турниров.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((tournament) => {
                const typeInfo = getTournamentTypeInfo(tournament.tournament_format);
                const isRegistered = registeredTournaments.includes(tournament.id);
                
                return (
                  <div 
                    key={tournament.id} 
                    className={`glass-card overflow-hidden card-hover ${typeInfo.borderColor}`}
                  >
                    <div className="h-40 bg-gradient-to-b from-fc-background/0 to-fc-background/80 relative">
                      <div className={`absolute inset-0 ${typeInfo.bgColor} opacity-20`}></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <h3 className={`text-2xl font-bold ${typeInfo.color}`}>{typeInfo.name}</h3>
                      </div>
                      
                      <div className={`absolute top-3 right-3 text-xs font-semibold px-3 py-1 rounded-full ${typeInfo.bgColor}`}>
                        {tournament.status === 'registration' && 'Регистрация'}
                        {tournament.status === 'active' && 'Активный'}
                        {tournament.status === 'completed' && 'Завершен'}
                      </div>
                    </div>
                    
                    <div className="p-5">
                      <h3 className="text-white text-xl font-semibold mb-3">{tournament.title}</h3>
                      
                      {tournament.description && (
                        <p className="text-gray-300 text-sm mb-4">{tournament.description}</p>
                      )}
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-400">
                          <Calendar size={16} className="mr-2" />
                          <span>
                            {tournament.start_date 
                              ? new Date(tournament.start_date).toLocaleDateString() 
                              : 'Дата начала будет объявлена'}
                          </span>
                        </div>
                        
                        <div className="flex items-center text-gray-400">
                          <Users size={16} className="mr-2" />
                          <span>{tournament.current_participants}/{tournament.max_participants} участников</span>
                        </div>
                        
                        {tournament.qualification_rating && (
                          <div className="flex items-center text-yellow-500">
                            <Star size={16} className="mr-2" />
                            <span>Мин. рейтинг: {tournament.qualification_rating}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center text-fc-accent font-medium">
                          <Trophy size={16} className="mr-2" />
                          <span>{tournament.prize_pool || 'Призовой фонд уточняется'}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        {isRegistered ? (
                          <button className="w-full bg-green-600 text-white py-2 rounded-md flex items-center justify-center" disabled>
                            <CheckCircle size={18} className="mr-2" />
                            Вы зарегистрированы
                          </button>
                        ) : canRegister(tournament) ? (
                          <button 
                            className="w-full bg-fc-accent text-fc-background py-2 rounded-md hover:bg-fc-accent-muted transition-colors"
                            onClick={() => handleRegister(tournament.id)}
                          >
                            Зарегистрироваться
                          </button>
                        ) : (
                          <button 
                            className="w-full bg-gray-700 text-white py-2 rounded-md opacity-70 cursor-not-allowed"
                            disabled
                            title={!isRegistrationOpen(tournament) 
                              ? "Регистрация закрыта" 
                              : tournament.qualification_rating && userRating && userRating < tournament.qualification_rating
                                ? `Требуется рейтинг не менее ${tournament.qualification_rating}`
                                : "Недоступно"
                            }
                          >
                            {!isRegistrationOpen(tournament) 
                              ? "Регистрация закрыта" 
                              : tournament.qualification_rating && userRating && userRating < tournament.qualification_rating
                                ? `Требуется рейтинг ${tournament.qualification_rating}`
                                : "Недоступно"
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default LongTermTournaments;
