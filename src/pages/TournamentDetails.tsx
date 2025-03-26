
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Trophy, Users, MapPin, Clock, ChevronRight, Calendar as CalendarIcon, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// For the comparison fix:
type TournamentStatus = 'active' | 'upcoming' | 'completed';

const tournaments = [
  {
    id: 1,
    title: "FC25 Cyber Championship",
    description: "Главный киберспортивный турнир по FC25 в СНГ. Участвуют 32 лучших игрока, отобранных через квалификационные турниры.",
    image: "/tournament1.jpg",
    startDate: "2023-12-10",
    endDate: "2023-12-12",
    status: "active" as TournamentStatus,
    prize: "₽1,000,000",
    players: 32,
    location: "Москва + Онлайн",
    organizer: "CyberSport Russia",
    registrationOpen: true,
    brackets: [
      {
        round: "1/8 финала",
        matches: [
          { player1: "AlexMaster", player2: "FCKing", score: "3-1", winner: "AlexMaster", time: "10:00" },
          { player1: "ProGamer2000", player2: "FootballWizard", score: "2-0", winner: "ProGamer2000", time: "11:00" },
          { player1: "FC_Legend", player2: "UltimateStriker", score: "1-2", winner: "UltimateStriker", time: "12:00" },
          { player1: "GoldenBoot", player2: "MidfielderPro", score: "0-0", winner: null, time: "13:00", status: "upcoming" },
          { player1: "DefenderKing", player2: "GoalkeeperAce", score: "0-0", winner: null, time: "14:00", status: "upcoming" },
          { player1: "TacticalGenius", player2: "WingerSpeed", score: "0-0", winner: null, time: "15:00", status: "upcoming" },
          { player1: "ControlMaster", player2: "StrikerElite", score: "0-0", winner: null, time: "16:00", status: "upcoming" },
          { player1: "PassingPro", player2: "DefenseTitan", score: "0-0", winner: null, time: "17:00", status: "upcoming" },
        ]
      },
      {
        round: "1/4 финала",
        matches: [
          { player1: "AlexMaster", player2: "ProGamer2000", score: "0-0", winner: null, time: "19:00", status: "upcoming" },
          { player1: "UltimateStriker", player2: "TBD", score: "0-0", winner: null, time: "20:00", status: "upcoming" },
          { player1: "TBD", player2: "TBD", score: "0-0", winner: null, time: "10:00", status: "upcoming" },
          { player1: "TBD", player2: "TBD", score: "0-0", winner: null, time: "11:00", status: "upcoming" },
        ]
      }
    ],
    participants: [
      { name: "AlexMaster", avatar: "/player1.jpg", rank: 1, platform: "PS5" },
      { name: "ProGamer2000", avatar: "/player2.jpg", rank: 2, platform: "Xbox" },
      { name: "FC_Legend", avatar: "/player3.jpg", rank: 3, platform: "PC" },
      { name: "UltimateStriker", avatar: "/player1.jpg", rank: 7, platform: "PS5" },
      { name: "FootballWizard", avatar: "/player2.jpg", rank: 15, platform: "Xbox" },
      { name: "GoldenBoot", avatar: "/player3.jpg", rank: 9, platform: "PC" },
      { name: "MidfielderPro", avatar: "/player1.jpg", rank: 24, platform: "PS5" },
      { name: "DefenderKing", avatar: "/player2.jpg", rank: 18, platform: "Xbox" },
      { name: "GoalkeeperAce", avatar: "/player3.jpg", rank: 22, platform: "PC" },
      { name: "TacticalGenius", avatar: "/player1.jpg", rank: 12, platform: "PS5" },
      { name: "WingerSpeed", avatar: "/player2.jpg", rank: 29, platform: "Xbox" },
      { name: "ControlMaster", avatar: "/player3.jpg", rank: 11, platform: "PC" },
      { name: "StrikerElite", avatar: "/player1.jpg", rank: 14, platform: "PS5" },
      { name: "PassingPro", avatar: "/player2.jpg", rank: 26, platform: "Xbox" },
      { name: "DefenseTitan", avatar: "/player3.jpg", rank: 20, platform: "PC" },
      { name: "FCKing", avatar: "/player1.jpg", rank: 32, platform: "PS5" },
    ],
    streams: [
      { title: "FC25 Championship Day 1", platform: "Twitch", url: "#", streamer: "CyberSportTV", time: "10:00" },
      { title: "FC25 Championship - Russian Stream", platform: "YouTube", url: "#", streamer: "FC Russia", time: "10:00" },
    ]
  },
  {
    id: 2,
    title: "FC25 Weekly Cup",
    description: "Еженедельный турнир для всех игроков, независимо от уровня. Быстрый формат, матчи в один день.",
    image: "/tournament2.jpg",
    startDate: "2023-12-15",
    endDate: "2023-12-15",
    status: "upcoming" as TournamentStatus,
    prize: "₽50,000",
    players: 16,
    location: "Онлайн",
    organizer: "FC Community",
    registrationOpen: true
  }
];

const TournamentDetails = () => {
  const { id } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  useEffect(() => {
    // In a real app, you would fetch the tournament from an API
    setLoading(true);
    window.scrollTo(0, 0);
    
    // Simulation of API call
    setTimeout(() => {
      const foundTournament = tournaments.find(t => t.id === Number(id));
      setTournament(foundTournament || null);
      setLoading(false);
    }, 500);
  }, [id]);

  const handleRegister = () => {
    toast({
      title: "Регистрация успешна",
      description: `Вы зарегистрированы на турнир ${tournament?.title}`,
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-fc-background text-white">
        <Navbar />
        <div className="pt-32 pb-16 px-6 text-center">
          <div className="animate-pulse">
            <div className="h-8 w-64 mx-auto bg-fc-muted rounded mb-4"></div>
            <div className="h-4 w-48 mx-auto bg-fc-muted rounded"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Not found state
  if (!tournament) {
    return (
      <div className="min-h-screen bg-fc-background text-white">
        <Navbar />
        <div className="pt-32 pb-16 px-6 text-center">
          <h1 className="text-3xl font-bold mb-4">Турнир не найден</h1>
          <p className="text-gray-400">Турнир с ID {id} не существует или был удален.</p>
        </div>
        <Footer />
      </div>
    );
  }

  // Format date range
  const formatDateRange = (start: string, end: string) => {
    if (start === end) {
      return start;
    }
    return `${start} - ${end}`;
  };

  // Get status badge
  const getStatusBadge = (status: TournamentStatus) => {
    if (status === "active") {
      return <Badge className="bg-green-500 hover:bg-green-600">Активный</Badge>;
    } else if (status === "upcoming") {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Скоро</Badge>;
    } else {
      return <Badge className="bg-gray-500 hover:bg-gray-600">Завершен</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      {/* Hero section */}
      <div 
        className="relative pt-24 pb-12 md:pt-32 md:pb-20 px-6 md:px-12 bg-gradient-to-b from-fc-background/80 to-fc-background"
        style={{
          backgroundImage: `url(${tournament.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundBlendMode: 'overlay'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-fc-background via-fc-background/90 to-transparent"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(tournament.status)}
                <span className="text-gray-400 text-sm">ID: {tournament.id}</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{tournament.title}</h1>
              
              <div className="flex flex-wrap gap-4 mb-4 text-sm">
                <div className="flex items-center text-gray-300">
                  <Calendar size={16} className="mr-1" />
                  {formatDateRange(tournament.startDate, tournament.endDate)}
                </div>
                <div className="flex items-center text-gray-300">
                  <Users size={16} className="mr-1" />
                  {tournament.players} участников
                </div>
                <div className="flex items-center text-gray-300">
                  <MapPin size={16} className="mr-1" />
                  {tournament.location}
                </div>
                <div className="flex items-center text-gray-300">
                  <Trophy size={16} className="mr-1" />
                  Приз: {tournament.prize}
                </div>
              </div>
              
              <p className="text-gray-400 max-w-3xl mb-6">{tournament.description}</p>
            </div>
            
            <div className="md:w-auto w-full">
              {tournament.registrationOpen ? (
                <Button onClick={handleRegister} className="w-full md:w-auto">
                  Зарегистрироваться
                </Button>
              ) : (
                <Button disabled className="w-full md:w-auto">
                  Регистрация закрыта
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Content section */}
      <div className="px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          <Tabs 
            defaultValue="overview" 
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 md:w-auto w-full mb-8 mt-4">
              <TabsTrigger value="overview" onClick={() => setActiveTab("overview")}>
                Обзор
              </TabsTrigger>
              <TabsTrigger value="brackets" onClick={() => setActiveTab("brackets")}>
                Сетка
              </TabsTrigger>
              <TabsTrigger value="participants" onClick={() => setActiveTab("participants")}>
                Участники
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-8">
              {/* Organizer */}
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Организатор</h2>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src="/placeholder.svg" />
                    <AvatarFallback>O</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-medium">{tournament.organizer}</h3>
                    <p className="text-gray-400">Официальный организатор турниров FC25</p>
                  </div>
                </div>
              </div>
              
              {/* Streams */}
              {tournament.streams && tournament.streams.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-xl font-bold mb-4">Трансляции</h2>
                  <div className="grid gap-4">
                    {tournament.streams.map((stream: any, index: number) => (
                      <Card key={index} className="bg-fc-muted/20 border-0 p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">{stream.title}</h3>
                            <div className="text-sm text-gray-400 flex items-center gap-4 mt-1">
                              <span>{stream.platform}</span>
                              <span className="flex items-center">
                                <User size={14} className="mr-1" />
                                {stream.streamer}
                              </span>
                              <span className="flex items-center">
                                <Clock size={14} className="mr-1" />
                                {stream.time}
                              </span>
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            Смотреть
                            <ChevronRight size={16} />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Schedule */}
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Расписание</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-fc-muted/20 rounded-lg">
                    <div className="bg-fc-accent rounded-full w-12 h-12 flex items-center justify-center shrink-0">
                      <CalendarIcon className="text-fc-background" />
                    </div>
                    <div>
                      <h3 className="font-medium">{tournament.startDate === tournament.endDate ? 'День турнира' : 'День 1'}</h3>
                      <p className="text-gray-400 mt-1">{tournament.startDate}</p>
                      {tournament.brackets && tournament.brackets[0] && (
                        <div className="mt-3 space-y-2">
                          {tournament.brackets[0].matches.slice(0, 3).map((match: any, i: number) => (
                            <div key={i} className="text-sm">
                              <span className="text-gray-400">{match.time}:</span> {match.player1} vs {match.player2}
                            </div>
                          ))}
                          {tournament.brackets[0].matches.length > 3 && (
                            <div className="text-sm text-fc-accent cursor-pointer">
                              +{tournament.brackets[0].matches.length - 3} еще
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {tournament.startDate !== tournament.endDate && (
                    <div className="flex items-start gap-4 p-4 bg-fc-muted/20 rounded-lg">
                      <div className="bg-fc-accent rounded-full w-12 h-12 flex items-center justify-center shrink-0">
                        <CalendarIcon className="text-fc-background" />
                      </div>
                      <div>
                        <h3 className="font-medium">День 2</h3>
                        <p className="text-gray-400 mt-1">{tournament.endDate}</p>
                        {tournament.brackets && tournament.brackets[1] && (
                          <div className="mt-3 space-y-2">
                            {tournament.brackets[1].matches.slice(0, 3).map((match: any, i: number) => (
                              <div key={i} className="text-sm">
                                <span className="text-gray-400">{match.time}:</span> {match.player1} vs {match.player2}
                              </div>
                            ))}
                            {tournament.brackets[1].matches.length > 3 && (
                              <div className="text-sm text-fc-accent cursor-pointer">
                                +{tournament.brackets[1].matches.length - 3} еще
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="brackets" className="space-y-8">
              {tournament.brackets ? (
                <div>
                  {tournament.brackets.map((bracket: any, index: number) => (
                    <div key={index} className="glass-card p-6 mb-6">
                      <h2 className="text-xl font-bold mb-4">{bracket.round}</h2>
                      <div className="grid gap-4">
                        {bracket.matches.map((match: any, idx: number) => (
                          <Card key={idx} className="bg-fc-muted/20 border-0 p-4">
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                              <div className="flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src="/player1.jpg" />
                                      <AvatarFallback>{match.player1.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className={match.winner === match.player1 ? "font-bold" : ""}>{match.player1}</span>
                                  </div>
                                  <div className="text-center text-xl font-bold">
                                    {match.status === "upcoming" ? "VS" : match.score}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={match.winner === match.player2 ? "font-bold" : ""}>{match.player2}</span>
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src="/player2.jpg" />
                                      <AvatarFallback>{match.player2.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                  </div>
                                </div>
                              </div>
                              <div className="ml-auto text-right flex items-center gap-2">
                                <div className="text-sm text-gray-400">
                                  <Clock size={14} className="inline mr-1" />
                                  {match.time}
                                </div>
                                {match.status === "upcoming" ? (
                                  <Badge variant="outline" className="ml-2">Ожидается</Badge>
                                ) : match.winner ? (
                                  <Badge className="bg-green-600 hover:bg-green-700 ml-2">Завершен</Badge>
                                ) : (
                                  <Badge className="bg-amber-600 hover:bg-amber-700 ml-2">Идет</Badge>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center">
                  <Trophy size={48} className="mx-auto text-gray-500 mb-4" />
                  <h3 className="text-xl font-medium mb-2">Сетка турнира появится скоро</h3>
                  <p className="text-gray-400">Сетка будет доступна после начала турнира.</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="participants" className="space-y-8">
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Участники ({tournament.participants?.length || 0}/{tournament.players})</h2>
                
                {tournament.participants ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {tournament.participants.map((participant: any, index: number) => (
                      <Card key={index} className="bg-fc-muted/20 border-0 p-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={participant.avatar} />
                            <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-medium">
                              <a href={`/players/${index + 1}`} className="hover:text-fc-accent transition-colors">
                                {participant.name}
                              </a>
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <span>Ранг: {participant.rank}</span>
                              <span>•</span>
                              <span>{participant.platform}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-400">
                    <Users size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Список участников пока не доступен</p>
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

export default TournamentDetails;
