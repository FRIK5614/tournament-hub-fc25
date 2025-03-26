
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Search } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 py-4 ${
        isScrolled ? 'bg-fc-background/90 backdrop-blur-md shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-fc-accent rounded-lg flex items-center justify-center">
            <span className="text-fc-background font-bold text-lg">FC</span>
          </div>
          <span className="text-white font-bold text-xl hidden sm:block">FC25 Hub</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link 
            to="/" 
            className={`transition-colors ${
              isActivePath('/') 
                ? 'text-fc-accent' 
                : 'text-white hover:text-fc-accent'
            }`}
          >
            Главная
          </Link>
          <Link 
            to="/tournaments" 
            className={`transition-colors ${
              isActivePath('/tournaments') 
                ? 'text-fc-accent' 
                : 'text-white hover:text-fc-accent'
            }`}
          >
            Турниры
          </Link>
          <Link 
            to="/streams" 
            className={`transition-colors ${
              isActivePath('/streams') 
                ? 'text-fc-accent' 
                : 'text-white hover:text-fc-accent'
            }`}
          >
            Трансляции
          </Link>
          <Link 
            to="/rankings" 
            className={`transition-colors ${
              isActivePath('/rankings') 
                ? 'text-fc-accent' 
                : 'text-white hover:text-fc-accent'
            }`}
          >
            Рейтинг
          </Link>
          <Link 
            to="/about" 
            className={`transition-colors ${
              isActivePath('/about') 
                ? 'text-fc-accent' 
                : 'text-white hover:text-fc-accent'
            }`}
          >
            О нас
          </Link>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <button className="text-white hover:text-fc-accent transition-colors">
            <Search size={20} />
          </button>
          <Link to="/login" className="btn-outline !py-2 !px-4">
            <User size={18} className="mr-2 inline" />
            <span className="hidden sm:inline">Войти</span>
          </Link>
          
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-white focus:outline-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-fc-background border-t border-fc-muted animate-fade-in">
          <div className="flex flex-col p-4 gap-4">
            <Link 
              to="/" 
              className={`transition-colors py-2 px-4 ${
                isActivePath('/') 
                  ? 'text-fc-accent' 
                  : 'text-white hover:text-fc-accent'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Главная
            </Link>
            <Link 
              to="/tournaments" 
              className={`transition-colors py-2 px-4 ${
                isActivePath('/tournaments') 
                  ? 'text-fc-accent' 
                  : 'text-white hover:text-fc-accent'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Турниры
            </Link>
            <Link 
              to="/streams" 
              className={`transition-colors py-2 px-4 ${
                isActivePath('/streams') 
                  ? 'text-fc-accent' 
                  : 'text-white hover:text-fc-accent'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Трансляции
            </Link>
            <Link 
              to="/rankings" 
              className={`transition-colors py-2 px-4 ${
                isActivePath('/rankings') 
                  ? 'text-fc-accent' 
                  : 'text-white hover:text-fc-accent'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Рейтинг
            </Link>
            <Link 
              to="/about" 
              className={`transition-colors py-2 px-4 ${
                isActivePath('/about') 
                  ? 'text-fc-accent' 
                  : 'text-white hover:text-fc-accent'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              О нас
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
