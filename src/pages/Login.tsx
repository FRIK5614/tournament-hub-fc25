
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Mail, Lock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isLoginMode) {
        // Login logic
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        toast({
          title: "Авторизация",
          description: "Вход выполнен успешно",
          variant: "default",
        });
        navigate('/');
      } else {
        // Registration logic
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            }
          }
        });

        if (error) throw error;

        toast({
          title: "Регистрация",
          description: "Аккаунт успешно создан. Проверьте вашу почту для подтверждения.",
          variant: "default",
        });
        
        // Switch to login mode after successful registration
        setIsLoginMode(true);
      }
    } catch (error: any) {
      toast({
        title: isLoginMode ? "Ошибка авторизации" : "Ошибка регистрации",
        description: error.message || "Произошла ошибка. Пожалуйста, попробуйте снова.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6 md:px-12">
        <div className="max-w-md mx-auto">
          <div className="glass-card p-6 md:p-8">
            <h1 className="text-2xl font-bold text-center mb-6">
              {isLoginMode ? 'Вход в аккаунт' : 'Регистрация'}
            </h1>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLoginMode && (
                <div className="space-y-2">
                  <label htmlFor="username" className="block text-sm font-medium text-gray-200">
                    Имя пользователя
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-fc-background/50 border border-fc-muted rounded-lg py-2 px-4 pl-10 text-white focus:outline-none focus:border-fc-accent"
                      placeholder="Выберите имя пользователя"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                  Email
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-fc-background/50 border border-fc-muted rounded-lg py-2 px-4 pl-10 text-white focus:outline-none focus:border-fc-accent"
                    placeholder="Введите email"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                  Пароль
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-fc-background/50 border border-fc-muted rounded-lg py-2 px-4 pl-10 pr-10 text-white focus:outline-none focus:border-fc-accent"
                    placeholder={isLoginMode ? "Введите пароль" : "Создайте пароль"}
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              {isLoginMode && (
                <div className="text-right">
                  <Link to="/forgot-password" className="text-sm text-fc-accent hover:underline">
                    Забыли пароль?
                  </Link>
                </div>
              )}
              
              <button
                type="submit"
                className="w-full bg-fc-accent text-fc-background font-semibold py-2 rounded-lg hover:bg-fc-accent-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading 
                  ? (isLoginMode ? 'Выполняется вход...' : 'Регистрация...') 
                  : (isLoginMode ? 'Войти' : 'Зарегистрироваться')}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                {isLoginMode ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
                {' '}
                <button
                  type="button"
                  className="text-fc-accent hover:underline"
                  onClick={() => setIsLoginMode(!isLoginMode)}
                  disabled={isLoading}
                >
                  {isLoginMode ? 'Регистрация' : 'Войти'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Login;
