
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TournamentHeader from '@/components/tournaments/TournamentHeader';
import TournamentTabs from '@/components/tournaments/TournamentTabs';
import QuickTournamentSection from '@/components/tournaments/QuickTournamentSection';

const Tournaments = () => {
  const [activeTournaments, setActiveTournaments] = useState<any[]>([]);
  const [completedTournaments, setCompletedTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userTournaments, setUserTournaments] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserTournaments = async () => {
      const { data: user } = await supabase.auth.getUser();
      
      if (user?.user) {
        const { data: participations, error } = await supabase
          .from('tournament_participants')
          .select('tournament_id(*, lobby:lobby_id(*))')
          .eq('user_id', user.user.id)
          .eq('tournament_id.status', 'active');

        if (participations) {
          setUserTournaments(participations.map(p => p.tournament_id));
        }
      }
    };

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    
    const fetchTournaments = async () => {
      try {
        const { data: active } = await supabase
          .from('tournaments')
          .select('*')
          .eq('status', 'active')
          .eq('tournament_format', 'quick')
          .order('created_at', { ascending: false })
          .limit(12);
          
        setActiveTournaments(active || []);
        
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
    fetchUserTournaments();
  }, []);

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <TournamentHeader />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <QuickTournamentSection isLoggedIn={isLoggedIn} />
            
            <div className="lg:col-span-2">
              <div className="glass-card p-6">
                <h3 className="text-xl font-semibold mb-4">Ваши текущие турниры</h3>
                {userTournaments.length > 0 ? (
                  <div className="space-y-4">
                    {userTournaments.map(tournament => (
                      <div 
                        key={tournament.id} 
                        className="flex justify-between items-center bg-fc-accent/10 p-4 rounded"
                      >
                        <span>{tournament.title}</span>
                        <a 
                          href={`/tournaments/${tournament.id}`} 
                          className="text-fc-accent hover:underline"
                        >
                          Перейти в турнир
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">У вас нет активных турниров</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="mb-10">
            <TournamentTabs 
              activeTournaments={activeTournaments}
              completedTournaments={completedTournaments}
              loading={loading}
            />
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Tournaments;
