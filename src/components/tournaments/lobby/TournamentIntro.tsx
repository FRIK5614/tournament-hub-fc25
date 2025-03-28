
import { Search, Users, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface TournamentIntroProps {
  onStartSearch: () => void;
  isLoading: boolean;
}

const TournamentIntro = ({ onStartSearch, isLoading }: TournamentIntroProps) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const handleSearchClick = () => {
    console.log("[TOURNAMENT-UI] Search button clicked in TournamentIntro");
    if (!isLoading) {
      onStartSearch();
    }
  };

  return (
    <div className="text-center">
      <motion.p 
        className="text-gray-300 mb-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        Быстрый турнир на 4 игрока с автоматическим подбором соперников.
      </motion.p>
      
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div 
          className="glass-card p-3 border border-white/5"
          variants={item}
        >
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-fc-accent/20 flex items-center justify-center mb-2">
              <Users size={16} className="text-fc-accent" />
            </div>
            <span className="text-sm">4 игрока</span>
          </div>
        </motion.div>
        
        <motion.div 
          className="glass-card p-3 border border-white/5"
          variants={item}
        >
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-fc-accent/20 flex items-center justify-center mb-2">
              <Clock size={16} className="text-fc-accent" />
            </div>
            <span className="text-sm">20 минут</span>
          </div>
        </motion.div>
        
        <motion.div 
          className="glass-card p-3 border border-white/5"
          variants={item}
        >
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-fc-accent/20 flex items-center justify-center mb-2">
              <ArrowRight size={16} className="text-fc-accent" />
            </div>
            <span className="text-sm">3 матча</span>
          </div>
        </motion.div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Button 
          onClick={handleSearchClick}
          disabled={isLoading}
          className="w-full bg-fc-accent hover:bg-fc-accent/90 text-fc-background transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,0,0.3)]"
        >
          {isLoading ? (
            <>
              <span className="animate-pulse mr-2">•</span>
              Загрузка...
            </>
          ) : (
            <>
              <Search size={16} className="mr-2" />
              Найти турнир
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
};

export default TournamentIntro;
