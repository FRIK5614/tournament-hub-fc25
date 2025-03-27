
import { useNavigate } from 'react-router-dom';
import QuickTournamentSearch from './QuickTournamentSearch';

interface QuickTournamentSectionProps {
  isLoggedIn: boolean;
}

const QuickTournamentSection = ({ isLoggedIn }: QuickTournamentSectionProps) => {
  const navigate = useNavigate();

  const redirectToLogin = () => {
    navigate('/login');
  };

  return (
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
  );
};

export default QuickTournamentSection;
