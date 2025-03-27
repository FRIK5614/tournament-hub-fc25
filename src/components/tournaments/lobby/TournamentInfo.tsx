
import { Trophy, Clock, Users, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface TournamentInfoProps {
  tournament: any;
}

const TournamentInfo = ({ tournament }: TournamentInfoProps) => {
  if (!tournament) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <Trophy className="text-fc-accent mr-3" size={24} />
        {tournament?.title || 'Быстрый турнир'}
      </h2>
      
      {tournament?.status === 'active' && (
        <motion.div 
          className="bg-fc-accent/20 border border-fc-accent/30 rounded-lg p-5 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <div className="w-6 h-6 rounded-full bg-fc-accent/30 flex items-center justify-center mr-2">
              <span className="text-xs text-fc-accent">i</span>
            </div>
            Информация о турнире
          </h3>
          
          <div className="space-y-3">
            <motion.div 
              className="flex items-start"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Users className="text-fc-accent mr-2 mt-1 flex-shrink-0" size={16} />
              <p className="text-gray-200">
                Турнир активен. Каждый участник играет с каждым по системе круговых встреч.
              </p>
            </motion.div>
            
            <motion.div 
              className="flex items-start"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Trophy className="text-fc-accent mr-2 mt-1 flex-shrink-0" size={16} />
              <p className="text-gray-200">
                За победу начисляется 3 очка, за ничью - 1 очко, за поражение - 0 очков.
              </p>
            </motion.div>
            
            <motion.div 
              className="flex items-start"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Clock className="text-fc-accent mr-2 mt-1 flex-shrink-0" size={16} />
              <p className="text-gray-200">
                У вас есть 20 минут на проведение каждого матча. Прогресс и результаты сохраняются автоматически.
              </p>
            </motion.div>
            
            <motion.div 
              className="flex items-start"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <ArrowRight className="text-fc-accent mr-2 mt-1 flex-shrink-0" size={16} />
              <p className="text-gray-200">
                Победитель определяется по количеству набранных очков. При равенстве очков учитываются личные встречи и разница забитых/пропущенных голов.
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default TournamentInfo;
