
import { Link } from 'react-router-dom';
import { Mail, Phone, Instagram, Facebook, Twitter } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-fc-card py-12 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and about */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-fc-accent rounded-lg flex items-center justify-center">
                <span className="text-fc-background font-bold text-lg">FC</span>
              </div>
              <span className="text-white font-bold text-xl">FC25 Hub</span>
            </Link>
            <p className="text-gray-400 text-sm">
              Киберспортивная платформа для проведения турниров по FC25. Участвуйте в турнирах, повышайте свой рейтинг и становитесь лучшим!
            </p>
          </div>
          
          {/* Quick links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Турниры</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/tournaments/active" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  Активные турниры
                </Link>
              </li>
              <li>
                <Link to="/tournaments/upcoming" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  Предстоящие турниры
                </Link>
              </li>
              <li>
                <Link to="/tournaments/results" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  Результаты турниров
                </Link>
              </li>
              <li>
                <Link to="/tournaments/rules" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  Правила турниров
                </Link>
              </li>
            </ul>
          </div>
          
          {/* More links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Информация</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  О нас
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  Условия использования
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-gray-400 hover:text-fc-accent transition-colors text-sm">
                  Политика конфиденциальности
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Контакты</h3>
            <ul className="space-y-3">
              <li>
                <a href="mailto:info@fc25hub.com" className="text-gray-400 hover:text-fc-accent transition-colors text-sm flex items-center">
                  <Mail size={16} className="mr-2" />
                  info@fc25hub.com
                </a>
              </li>
              <li>
                <a href="tel:+78001234567" className="text-gray-400 hover:text-fc-accent transition-colors text-sm flex items-center">
                  <Phone size={16} className="mr-2" />
                  +7 (800) 123-45-67
                </a>
              </li>
            </ul>
            
            <div className="mt-6">
              <h4 className="text-white font-medium text-sm mb-3">Мы в соцсетях</h4>
              <div className="flex space-x-3">
                <a href="#" className="w-9 h-9 rounded-full bg-fc-background flex items-center justify-center text-gray-400 hover:text-fc-accent transition-colors">
                  <Instagram size={18} />
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-fc-background flex items-center justify-center text-gray-400 hover:text-fc-accent transition-colors">
                  <Facebook size={18} />
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-fc-background flex items-center justify-center text-gray-400 hover:text-fc-accent transition-colors">
                  <Twitter size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-6 border-t border-fc-muted text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} FC25 Hub. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
