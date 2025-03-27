
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Menu, X, LogOut } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Navbar = () => {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: 'Выход из системы',
        description: 'Вы успешно вышли из системы',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось выйти из системы',
        variant: 'destructive',
      });
    }
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const navLinks = [
    { label: 'Главная', path: '/' },
    { label: 'Турниры', path: '/tournaments' },
    { label: 'Рейтинг', path: '/rankings' },
    { label: 'Стримы', path: '/streams' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-fc-background shadow-md py-4 px-6 md:px-12">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2">
          <img src="/logo.svg" alt="FC25Hub Logo" className="h-8 w-8" />
          <span className="font-bold text-xl hidden sm:inline">FC25Hub</span>
        </Link>

        {isMobile ? (
          <>
            <button 
              onClick={toggleMenu} 
              className="text-white focus:outline-none"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            {menuOpen && (
              <div className="absolute top-16 left-0 right-0 bg-fc-background border-t border-gray-800 p-4">
                <div className="flex flex-col space-y-3">
                  {navLinks.map(link => (
                    <Link 
                      key={link.path} 
                      to={link.path} 
                      className="px-3 py-2 rounded hover:bg-fc-card-dark"
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  {isAuthenticated && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleLogout}
                      className="w-full mt-2"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Выйти
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center space-x-6">
            {navLinks.map(link => (
              <Link 
                key={link.path} 
                to={link.path} 
                className="text-gray-300 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="ml-4"
                  >
                    Профиль
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout} className="text-red-500">
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
