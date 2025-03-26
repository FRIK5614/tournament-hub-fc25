
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const Hero = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after component mounts
    setIsVisible(true);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background with gradient overlay */}
      <div 
        className="absolute inset-0 bg-[url('/tournament1.jpg')] bg-cover bg-center"
        style={{ 
          backgroundPosition: "center 30%",
          filter: "brightness(0.4)"
        }}
      />
      
      {/* Accent gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-fc-background via-transparent to-fc-background" />
      
      {/* Content */}
      <div className="container mx-auto px-6 md:px-12 z-10 max-w-6xl">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`transition-all duration-1000 ease-out transform ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <span className="inline-block bg-fc-accent/20 text-fc-accent text-sm md:text-base font-medium px-4 py-1.5 rounded-full mb-4">
              Киберспортивная платформа
            </span>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Турниры FC25 <span className="text-fc-accent">нового уровня</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Участвуйте в рейтинговых турнирах, поднимайтесь в таблице лидеров и станьте лучшим игроком в FC25
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/tournaments" className="btn-primary group">
                Найти турнир
                <ArrowRight size={18} className="ml-2 inline-block transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/register" className="btn-outline">
                Регистрация
              </Link>
            </div>
          </div>
          
          {/* Stats */}
          <div className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 transition-all duration-1000 delay-300 ease-out transform ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <div className="glass-card p-4 md:p-6">
              <h3 className="text-fc-accent text-3xl md:text-4xl font-bold mb-1">25+</h3>
              <p className="text-gray-400 text-sm md:text-base">Турниров в день</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <h3 className="text-fc-accent text-3xl md:text-4xl font-bold mb-1">1200+</h3>
              <p className="text-gray-400 text-sm md:text-base">Активных игроков</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <h3 className="text-fc-accent text-3xl md:text-4xl font-bold mb-1">5000₽</h3>
              <p className="text-gray-400 text-sm md:text-base">Средний призовой фонд</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <h3 className="text-fc-accent text-3xl md:text-4xl font-bold mb-1">24/7</h3>
              <p className="text-gray-400 text-sm md:text-base">Техподдержка</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom gradient for smooth transition */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-fc-background to-transparent"></div>
    </div>
  );
};

export default Hero;
