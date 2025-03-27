
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

const ActiveTournaments = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

    if (document.getElementById('tournaments-section')) {
      observer.observe(document.getElementById('tournaments-section')!);
    }
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchActiveTournaments = async () => {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(4);
          
        if (error) {
          console.error('Error fetching tournaments:', error);
        } else {
          setTournaments(data || []);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error in tournament fetch:', err);
        setLoading(false);
      }
    };
    
    fetchActiveTournaments();
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
          
          {loading ? (
            <div className="text-center mt-12">
              <div className="glass-card p-12">
                <p className="text-gray-400">Загрузка турниров...</p>
              </div>
            </div>
          ) : tournaments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {tournaments.map((tournament, index) => (
                <Link 
                  key={tournament.id}
                  to={`/tournaments/${tournament.id}`}
                  className={`glass-card p-5 card-hover transition-all duration-700 ease-out transform delay-${index * 100} ${
                    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <h3 className="text-white text-lg font-semibold mb-3">{tournament.title}</h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-400">
                      <span>Активный турнир</span>
                    </div>
                    
                    <div className="flex items-center text-gray-400">
                      <span>{tournament.current_participants}/{tournament.max_participants} игроков</span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="w-full py-2 rounded-md text-center bg-fc-accent text-fc-background font-medium">
                      Подробнее
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center mt-12">
              <div className="glass-card p-12">
                <p className="text-gray-400">Активных турниров пока нет</p>
              </div>
            </div>
          )}
          
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
