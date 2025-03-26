
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Medal, Award, Gift, Calendar, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

// Расширенные данные о игроках
const extendedPlayerData = [
  {
    id: 1,
    name: 'AlexMaster',
    avatar: '/player1.jpg',
    rating: 2145,
    platform: 'ps5' as const,
    wins: 124,
    change: 15,
    rank: 1,
    country: 'Россия',
    winRate: '76%',
    tournamentsPlayed: 42,
    tournamentsWon: 8,
    matchesPlayed: 174,
    matchesWon: 132,
    matchesLost: 42,
    bio: 'Профессиональный игрок FC25, многократный чемпион региональных турниров. Специализируюсь на тактической игре с акцентом на контроль мяча.',
    titles: [
      { name: 'Чемпион FC25 Pro League 2023', date: '2023-12-10', icon: 'trophy' },
      { name: 'MVP Сезона', date: '2023-11-05', icon: 'medal' },
      { name: 'Лучший бомбардир месяца', date: '2023-10-15', icon: 'award' },
      { name: 'Подарок от фаната', date: '2023-09-20', icon: 'gift' },
    ],
    recentMatches: [
      { opponent: 'ProGamer2000', result: 'win', score: '3-1', date: '2023-12-15' },
      { opponent: 'FC_Legend', result: 'win', score: '2-0', date: '2023-12-10' },
      { opponent: 'TacticalMaster', result: 'loss', score: '1-2', date: '2023-12-05' },
      { opponent: 'KingOfFC', result: 'win', score: '4-2', date: '2023-12-01' },
      { opponent: 'StrikerElite', result: 'win', score: '2-1', date: '2023-11-25' },
    ],
    comments: [
      { id: 1, user: 'FC_Legend', avatar: '/player3.jpg', text: 'Отличная игра вчера! Твоя тактика с высоким прессингом сработала идеально.', date: '2023-12-16' },
      { id: 2, user: 'ProGamer2000', avatar: '/player2.jpg', text: 'Нужно будет как-нибудь сыграть товарищеский матч для тренировки.', date: '2023-12-10' },
      { id: 3, user: 'KingOfFC', avatar: '/player1.jpg', text: 'Поздравляю с победой в турнире! Заслуженно!', date: '2023-12-05' },
    ]
  },
  {
    id: 2,
    name: 'ProGamer2000',
    avatar: '/player2.jpg',
    rating: 2089,
    platform: 'xbox' as const,
    wins: 118,
    change: -5,
    rank: 2,
    country: 'Украина',
    winRate: '72%',
    tournamentsPlayed: 39,
    tournamentsWon: 6,
    matchesPlayed: 168,
    matchesWon: 121,
    matchesLost: 47,
    bio: 'Игрок со стажем более 5 лет в серии FC. Предпочитаю агрессивный атакующий стиль и быстрые контратаки.',
    titles: [
      { name: 'Победитель Winter Cup 2023', date: '2023-02-15', icon: 'trophy' },
      { name: 'Лучший игрок месяца', date: '2023-04-10', icon: 'medal' },
      { name: 'Мастер пасов', date: '2023-06-22', icon: 'award' },
    ],
    recentMatches: [
      { opponent: 'AlexMaster', result: 'loss', score: '1-3', date: '2023-12-15' },
      { opponent: 'TacticalMaster', result: 'win', score: '2-1', date: '2023-12-12' },
      { opponent: 'DefenderPro', result: 'win', score: '3-0', date: '2023-12-08' },
      { opponent: 'StrikerElite', result: 'win', score: '2-1', date: '2023-12-03' },
      { opponent: 'FC_Legend', result: 'loss', score: '1-2', date: '2023-11-28' },
    ],
    comments: [
      { id: 1, user: 'AlexMaster', avatar: '/player1.jpg', text: 'Хорошая игра! В следующий раз будет реванш.', date: '2023-12-16' },
      { id: 2, user: 'TacticalMaster', avatar: '/player2.jpg', text: 'Твоя игра с каждым матчем становится лучше!', date: '2023-12-09' },
    ]
  },
  // Остальные игроки (сокращенные данные)
  {
    id: 3,
    name: 'FC_Legend',
    avatar: '/player3.jpg',
    rating: 2067,
    platform: 'pc' as const,
    wins: 112,
    change: 8,
    rank: 3,
    country: 'Беларусь',
    winRate: '68%',
    tournamentsPlayed: 36,
    tournamentsWon: 5,
    matchesPlayed: 160,
    matchesWon: 109,
    matchesLost: 51,
    bio: 'Опытный игрок с сильным акцентом на защиту и выжидание ошибок соперника.',
    titles: [],
    recentMatches: [],
    comments: []
  },
  {
    id: 4,
    name: 'KingOfFC',
    avatar: '/player1.jpg',
    rating: 2031,
    platform: 'ps5' as const,
    wins: 109,
    change: 0,
    rank: 4,
    country: 'Казахстан',
    winRate: '65%',
    tournamentsPlayed: 35,
    tournamentsWon: 4,
    matchesPlayed: 155,
    matchesWon: 101,
    matchesLost: 54,
    bio: 'Мастер стандартных положений и дальних ударов.',
    titles: [],
    recentMatches: [],
    comments: []
  }
];

const PlayerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    // Имитация загрузки данных
    setLoading(true);
    window.scrollTo(0, 0);
    
    setTimeout(() => {
      const foundPlayer = extendedPlayerData.find(p => p.id === Number(id));
      if (foundPlayer) {
        setPlayer(foundPlayer);
        setComments(foundPlayer.comments || []);
      }
      setLoading(false);
    }, 500);
  }, [id]);

  const handlePostComment = () => {
    if (!commentText.trim()) return;
    
    const newComment = {
      id: comments.length + 1,
      user: 'Вы',
      avatar: '/player2.jpg', // Заглушка для текущего пользователя
      text: commentText.trim(),
      date: new Date().toISOString().split('T')[0]
    };
    
    setComments([newComment, ...comments]);
    setCommentText("");
    toast.success("Комментарий добавлен");
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'trophy':
        return <Trophy className="text-yellow-500" />;
      case 'medal':
        return <Medal className="text-gray-300" />;
      case 'award':
        return <Award className="text-amber-700" />;
      case 'gift':
        return <Gift className="text-purple-500" />;
      default:
        return <Trophy className="text-yellow-500" />;
    }
  };

  // Если загружаем или игрок не найден
  if (loading) {
    return (
      <div className="min-h-screen bg-fc-background text-white">
        <Navbar />
        <div className="pt-32 pb-16 px-6 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-fc-muted mb-4"></div>
            <div className="h-8 w-64 bg-fc-muted rounded mb-4"></div>
            <div className="h-4 w-48 bg-fc-muted rounded"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-fc-background text-white">
        <Navbar />
        <div className="pt-32 pb-16 px-6 text-center">
          <h1 className="text-3xl font-bold mb-4">Игрок не найден</h1>
          <p className="text-gray-400">Игрок с ID {id} не существует или был удален.</p>
        </div>
        <Footer />
      </div>
    );
  }

  // Платформы и их цвета
  const platformStyles = {
    ps5: "border-blue-500",
    xbox: "border-green-500",
    pc: "border-yellow-500"
  };

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Шапка профиля */}
          <div className="glass-card p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Аватар */}
              <div className={`relative w-32 h-32 rounded-full border-4 ${platformStyles[player.platform]} overflow-hidden`}>
                <img 
                  src={player.avatar} 
                  alt={player.name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 right-0 bg-fc-background text-xs font-bold px-2 py-1 rounded-sm">
                  {player.platform.toUpperCase()}
                </div>
              </div>
              
              {/* Основная информация */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">{player.name}</h1>
                  <div className="flex items-center justify-center md:justify-start">
                    {player.rank <= 3 && (
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full mx-2 ${
                        player.rank === 1 
                          ? 'bg-yellow-500' 
                          : player.rank === 2 
                            ? 'bg-gray-300' 
                            : 'bg-amber-700'
                      } text-fc-background font-bold`}>
                        {player.rank}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-gray-400 mb-4">
                  <span className="mr-4">{player.country}</span>
                  <span className="flex items-center gap-1 inline-flex mr-4">
                    <Star size={14} className="text-fc-accent" />
                    <span className="text-fc-accent font-medium">{player.rating}</span>
                    {player.change !== 0 && (
                      <span className={`text-xs ${player.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {player.change > 0 ? '+' : ''}{player.change}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 inline-flex">
                    <Trophy size={14} className="text-fc-accent" />
                    <span>{player.wins} побед</span>
                  </span>
                </div>
                
                <p className="text-gray-300 mb-5">{player.bio}</p>
                
                {/* Статистика */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="glass-card p-3 text-center">
                    <div className="text-sm text-gray-400">Турниров</div>
                    <div className="text-xl font-bold">{player.tournamentsPlayed}</div>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <div className="text-sm text-gray-400">Побед в турнирах</div>
                    <div className="text-xl font-bold">{player.tournamentsWon}</div>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <div className="text-sm text-gray-400">Матчей</div>
                    <div className="text-xl font-bold">{player.matchesPlayed}</div>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <div className="text-sm text-gray-400">Винрейт</div>
                    <div className="text-xl font-bold">{player.winRate}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Вкладки профиля */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-3 mb-8">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="trophies">Достижения</TabsTrigger>
              <TabsTrigger value="wall">Стена</TabsTrigger>
            </TabsList>
            
            {/* Вкладка обзора */}
            <TabsContent value="overview" className="space-y-8">
              {/* Статистика матчей */}
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Статистика матчей</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Винрейт */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Винрейт</span>
                      <span className="font-medium">{player.winRate}</span>
                    </div>
                    <Progress value={parseInt(player.winRate)} className="h-2" />
                  </div>
                  
                  {/* Побед/Поражений */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Победы/Поражения</span>
                      <span className="font-medium">{player.matchesWon} / {player.matchesLost}</span>
                    </div>
                    <div className="flex h-2">
                      <div 
                        className="bg-green-500 rounded-l-full" 
                        style={{ width: `${player.matchesWon / player.matchesPlayed * 100}%` }}
                      ></div>
                      <div 
                        className="bg-red-500 rounded-r-full" 
                        style={{ width: `${player.matchesLost / player.matchesPlayed * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Последние матчи */}
              {player.recentMatches && player.recentMatches.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-xl font-bold mb-4">Последние матчи</h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Соперник</TableHead>
                        <TableHead>Счет</TableHead>
                        <TableHead>Результат</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.recentMatches.map((match: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{match.date}</TableCell>
                          <TableCell>{match.opponent}</TableCell>
                          <TableCell>{match.score}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              match.result === 'win' ? 'bg-green-500/20 text-green-500' : 
                              'bg-red-500/20 text-red-500'
                            }`}>
                              {match.result === 'win' ? 'Победа' : 'Поражение'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            {/* Вкладка достижений */}
            <TabsContent value="trophies" className="space-y-8">
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Достижения и награды</h2>
                
                {player.titles && player.titles.length > 0 ? (
                  <div className="space-y-4">
                    {player.titles.map((title: any, index: number) => (
                      <div key={index} className="flex items-center p-4 bg-fc-muted/20 rounded-lg">
                        <div className="w-12 h-12 flex items-center justify-center bg-fc-background rounded-full mr-4">
                          {getIconComponent(title.icon)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{title.name}</h3>
                          <div className="flex items-center text-sm text-gray-400">
                            <Calendar size={14} className="mr-1" />
                            {title.date}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-400">
                    <Trophy size={48} className="mx-auto mb-3 opacity-30" />
                    <p>У игрока пока нет достижений</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Вкладка стены сообщений */}
            <TabsContent value="wall" className="space-y-8">
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Стена сообщений</h2>
                
                {/* Форма комментария */}
                <div className="mb-6 p-4 bg-fc-muted/20 rounded-lg">
                  <Textarea 
                    placeholder="Написать комментарий..."
                    className="mb-3"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <Button 
                    onClick={handlePostComment}
                    disabled={!commentText.trim()}
                    className="ml-auto block"
                  >
                    <Send size={16} className="mr-2" />
                    Отправить
                  </Button>
                </div>
                
                {/* Комментарии */}
                {comments.length > 0 ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-4 p-4 bg-fc-muted/10 rounded-lg">
                          <Avatar>
                            <AvatarImage src={comment.avatar} />
                            <AvatarFallback>{comment.user.substr(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="font-medium">{comment.user}</h4>
                              <span className="text-xs text-gray-400">{comment.date}</span>
                            </div>
                            <p className="text-gray-300">{comment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center p-8 text-gray-400">
                    <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Комментариев пока нет. Будьте первым!</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default PlayerProfile;
