
import { Trophy, Info, Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

const TournamentInfo = () => {
  return (
    <motion.div 
      className="glass-card p-6 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h3 className="text-xl font-semibold mb-6 flex items-center">
        <Trophy className="text-fc-accent mr-2" size={20} />
        <span>О турнирах</span>
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div 
          className="bg-fc-background/50 backdrop-blur-sm rounded-lg p-4 border border-white/5 hover:border-fc-accent/30 transition-all duration-300"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          whileHover={{ scale: 1.03 }}
        >
          <h4 className="font-medium mb-2 flex items-center">
            <Badge variant="outline" className="mr-2 bg-fc-accent/20 text-fc-accent border-fc-accent/20">
              <span className="mr-1">4</span>
              <Users size={14} />
            </Badge>
            Быстрые турниры
          </h4>
          <p className="text-sm text-gray-300">
            Быстрые турниры на 4 игрока, где каждый играет с каждым. 
            Матчи проходят сразу же после формирования состава участников.
          </p>
        </motion.div>
        
        <motion.div 
          className="bg-fc-background/50 backdrop-blur-sm rounded-lg p-4 border border-white/5 hover:border-blue-500/30 transition-all duration-300"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          whileHover={{ scale: 1.03 }}
        >
          <h4 className="font-medium mb-2 flex items-center">
            <Badge variant="outline" className="mr-2 bg-blue-500/20 text-blue-400 border-blue-500/20">
              <span className="mr-1">∞</span>
              <Clock size={14} />
            </Badge>
            Долгосрочные турниры
          </h4>
          <p className="text-sm text-gray-300">
            Три уровня ежемесячных турниров с призовым фондом: 
            Лига конференций, Лига Европы и Лига чемпионов.
          </p>
        </motion.div>
      </div>
      
      <motion.div 
        className="mt-4 bg-gradient-to-r from-fc-accent/10 to-blue-500/10 p-3 rounded-lg border border-white/5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="flex items-start">
          <Info size={16} className="text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-xs text-gray-300">
            Победы повышают ваш рейтинг для участия в долгосрочных турнирах. Турниры проводятся по правилам, аналогичным турнирам УЕФА.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TournamentInfo;
