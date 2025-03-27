
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const TournamentHeader = () => {
  return (
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
  );
};

export default TournamentHeader;
