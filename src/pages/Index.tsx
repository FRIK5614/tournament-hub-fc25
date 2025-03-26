
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import ActiveTournaments from '@/components/ActiveTournaments';
import TopPlayers from '@/components/TopPlayers';
import Footer from '@/components/Footer';

const Index = () => {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      <Hero />
      <ActiveTournaments />
      <TopPlayers />
      
      {/* How it works section */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="section-title">Как это работает</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="glass-card p-6 text-center">
              <div className="w-16 h-16 bg-fc-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-fc-accent text-2xl font-bold">1</span>
              </div>
              <h3 className="text-white text-xl font-semibold mb-3">Регистрация</h3>
              <p className="text-gray-400">
                Создайте учетную запись, указав свой ник на игровой платформе и предпочитаемую систему (PS5, Xbox, PC)
              </p>
            </div>
            
            <div className="glass-card p-6 text-center">
              <div className="w-16 h-16 bg-fc-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-fc-accent text-2xl font-bold">2</span>
              </div>
              <h3 className="text-white text-xl font-semibold mb-3">Выбор турнира</h3>
              <p className="text-gray-400">
                Присоединитесь к активному турниру или зарегистрируйтесь на предстоящий, просмотрев доступные варианты
              </p>
            </div>
            
            <div className="glass-card p-6 text-center">
              <div className="w-16 h-16 bg-fc-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-fc-accent text-2xl font-bold">3</span>
              </div>
              <h3 className="text-white text-xl font-semibold mb-3">Участие и рейтинг</h3>
              <p className="text-gray-400">
                Играйте матчи, загружайте результаты и поднимайтесь в общем рейтинге игроков FC25
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA section */}
      <section className="py-16 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/tournament3.jpg')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-fc-background to-fc-background/80" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Готовы присоединиться к киберспортивному сообществу FC25?</h2>
            <p className="text-gray-300 text-lg mb-8">
              Зарегистрируйтесь сейчас и начните свой путь к вершине турнирной таблицы!
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="/register" className="btn-primary">
                Создать аккаунт
              </a>
              <a href="/tournaments" className="btn-outline">
                Смотреть турниры
              </a>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default Index;
