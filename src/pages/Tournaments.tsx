
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from "@/integrations/supabase/client";
import TournamentHeader from '@/components/tournaments/TournamentHeader';
import TournamentInfo from '@/components/tournaments/TournamentInfo';
import TournamentTabs from '@/components/tournaments/TournamentTabs';
import QuickTournamentSection from '@/components/tournaments/QuickTournamentSection';

const Tournaments = () => {
  const [activeTournaments, setActiveTournaments] = useState<any[]>([]);
  const [completedTournaments, setCompletedTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <TournamentHeader />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <QuickTournamentSection isLoggedIn={isLoggedIn} />
            
            <div className="lg:col-span-2">
              <TournamentInfo />
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
