
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TournamentLobby from '@/components/tournaments/TournamentLobby';
import { Loader2, Trophy, Calendar, Users } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TournamentDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTournament = async () => {
      if (!id) return;
      
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        
        setTournament(data);
        setLoading(false);
      } catch (error: any) {
        toast({
          title: "Ошибка загрузки",
          description: "Не удалось загрузить информацию о турнире",
          variant: "destructive",
        });
        setLoading(false);
      }
    };
    
    fetchTournament();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-fc-background text-white">
        <Navbar />
        <div className="pt-24 pb-16 px-6 md:px-12 flex justify-center items-center">
          <Loader2 className="animate-spin" size={32} />
        </div>
        <Footer />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-fc-background text-white">
        <Navbar />
        <div className="pt-24 pb-16 px-6 md:px-12">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Турнир не найден</h1>
            <p className="text-gray-400">
              Запрашиваемый турнир не существует или был удален.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{tournament.title}</h1>
            
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="glass-card px-4 py-2 inline-flex items-center">
                <Calendar size={16} className="mr-2 text-gray-400" />
                <span>{new Date(tournament.created_at).toLocaleDateString()}</span>
              </div>
              
              <div className="glass-card px-4 py-2 inline-flex items-center">
                <Users size={16} className="mr-2 text-gray-400" />
                <span>{tournament.current_participants}/{tournament.max_participants} участников</span>
              </div>
              
              <div className="glass-card px-4 py-2 inline-flex items-center">
                <Trophy size={16} className="mr-2 text-fc-accent" />
                <span className="text-fc-accent font-medium">
                  {tournament.prize_pool || 'Без призового фонда'}
                </span>
              </div>
              
              <div className={`glass-card px-4 py-2 inline-flex items-center ${
                tournament.status === 'active' 
                  ? 'bg-green-500/20 text-green-500' 
                  : tournament.status === 'completed'
                    ? 'bg-gray-500/20 text-gray-300'
                    : 'bg-yellow-500/20 text-yellow-500'
              }`}>
                {tournament.status === 'active' && 'Активный'}
                {tournament.status === 'completed' && 'Завершен'}
                {tournament.status === 'registration' && 'Регистрация'}
              </div>
            </div>
            
            {tournament.description && (
              <p className="text-gray-300 mb-8">{tournament.description}</p>
            )}
          </div>
          
          {tournament.status === 'active' && (
            <TournamentLobby tournamentId={tournament.id} />
          )}
          
          {tournament.status === 'completed' && (
            <div className="glass-card p-6 text-center">
              <h2 className="text-2xl font-bold mb-4">Турнир завершен</h2>
              <p className="text-gray-300 mb-6">
                Этот турнир уже завершен. Вы можете посмотреть результаты ниже.
              </p>
              
              <TournamentLobby tournamentId={tournament.id} />
            </div>
          )}
          
          {tournament.status === 'registration' && (
            <div className="glass-card p-6 text-center">
              <h2 className="text-2xl font-bold mb-4">Регистрация открыта</h2>
              <p className="text-gray-300 mb-6">
                Регистрация на этот турнир открыта. Вы можете зарегистрироваться на странице долгосрочных турниров.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default TournamentDetails;
