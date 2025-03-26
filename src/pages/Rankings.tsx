
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Trophy, Star, Filter, ArrowDown, ArrowUp, Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// Sample extended player data with more players
const extendedPlayerData = [
  {
    id: 1,
    name: 'AlexMaster',
    avatar: '/player1.jpg',
    rating: 2145,
    platform: 'ps5',
    wins: 124,
    change: 15,
    rank: 1,
    country: 'Россия',
    winRate: '76%',
    tournamentsPlayed: 42
  },
  {
    id: 2,
    name: 'ProGamer2000',
    avatar: '/player2.jpg',
    rating: 2089,
    platform: 'xbox',
    wins: 118,
    change: -5,
    rank: 2,
    country: 'Украина',
    winRate: '72%',
    tournamentsPlayed: 39
  },
  {
    id: 3,
    name: 'FC_Legend',
    avatar: '/player3.jpg',
    rating: 2067,
    platform: 'pc',
    wins: 112,
    change: 8,
    rank: 3,
    country: 'Беларусь',
    winRate: '68%',
    tournamentsPlayed: 36
  },
  {
    id: 4,
    name: 'KingOfFC',
    avatar: '/player1.jpg',
    rating: 2031,
    platform: 'ps5',
    wins: 109,
    change: 0,
    rank: 4,
    country: 'Казахстан',
    winRate: '65%',
    tournamentsPlayed: 35
  },
  {
    id: 5,
    name: 'TacticalMaster',
    avatar: '/player2.jpg',
    rating: 2010,
    platform: 'xbox',
    wins: 102,
    change: 12,
    rank: 5,
    country: 'Россия',
    winRate: '63%',
    tournamentsPlayed: 34
  },
  {
    id: 6,
    name: 'DefenderPro',
    avatar: '/player3.jpg',
    rating: 1985,
    platform: 'pc',
    wins: 97,
    change: -3,
    rank: 6,
    country: 'Россия',
    winRate: '60%',
    tournamentsPlayed: 32
  },
  {
    id: 7,
    name: 'StrikerElite',
    avatar: '/player1.jpg',
    rating: 1962,
    platform: 'ps5',
    wins: 93,
    change: 6,
    rank: 7,
    country: 'Украина',
    winRate: '58%',
    tournamentsPlayed: 31
  },
  {
    id: 8,
    name: 'MidfielderKing',
    avatar: '/player2.jpg',
    rating: 1944,
    platform: 'xbox',
    wins: 89,
    change: 10,
    rank: 8,
    country: 'Беларусь',
    winRate: '55%',
    tournamentsPlayed: 30
  },
  {
    id: 9,
    name: 'GoalkeeperAce',
    avatar: '/player3.jpg',
    rating: 1921,
    platform: 'pc',
    wins: 86,
    change: -7,
    rank: 9,
    country: 'Казахстан',
    winRate: '53%',
    tournamentsPlayed: 29
  },
  {
    id: 10,
    name: 'SkillMaster',
    avatar: '/player1.jpg',
    rating: 1905,
    platform: 'ps5',
    wins: 82,
    change: 0,
    rank: 10,
    country: 'Россия',
    winRate: '50%',
    tournamentsPlayed: 28
  },
  {
    id: 11,
    name: 'TacticalFC',
    avatar: '/player2.jpg',
    rating: 1883,
    platform: 'xbox',
    wins: 79,
    change: 4,
    rank: 11,
    country: 'Украина',
    winRate: '48%',
    tournamentsPlayed: 27
  },
  {
    id: 12,
    name: 'DefenseWall',
    avatar: '/player3.jpg',
    rating: 1864,
    platform: 'pc',
    wins: 75,
    change: -2,
    rank: 12,
    country: 'Беларусь',
    winRate: '46%',
    tournamentsPlayed: 26
  }
];

type TimeFilter = '24h' | 'week' | 'month' | 'alltime';

const RankingsPage = () => {
  const [players, setPlayers] = useState(extendedPlayerData);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('alltime');
  const playersPerPage = 10;

  // Platform styles
  const platformStyles = {
    ps5: "border-blue-500",
    xbox: "border-green-500",
    pc: "border-yellow-500"
  };

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  // Handle search and filtering
  useEffect(() => {
    let filteredPlayers = [...extendedPlayerData];

    // Apply time filter (mock implementation)
    if (timeFilter !== 'alltime') {
      // This is just a simple mock - in a real app, you'd fetch different data based on timeFilter
      // Here we'll just modify the rankings slightly to simulate different time periods
      filteredPlayers = filteredPlayers.map(player => {
        const randomAdjustment = Math.floor(Math.random() * 30) - 15;
        return {
          ...player,
          rating: Math.max(1500, player.rating + (timeFilter === '24h' ? randomAdjustment * 2 : 
                                                 timeFilter === 'week' ? randomAdjustment : 
                                                 randomAdjustment / 2)),
          rank: player.rank, // We'll sort and reassign ranks after filtering
          wins: Math.max(1, player.wins + (timeFilter === '24h' ? Math.floor(randomAdjustment / 10) : 
                                          timeFilter === 'week' ? Math.floor(randomAdjustment / 5) : 
                                          Math.floor(randomAdjustment / 3))),
          change: timeFilter === '24h' ? Math.floor(Math.random() * 10) - 5 :
                 timeFilter === 'week' ? Math.floor(Math.random() * 15) - 7 :
                 Math.floor(Math.random() * 20) - 10
        };
      });
      
      // Re-sort by rating to simulate new rankings for the time period
      filteredPlayers.sort((a, b) => b.rating - a.rating);
      
      // Re-assign ranks
      filteredPlayers = filteredPlayers.map((player, index) => ({
        ...player,
        rank: index + 1
      }));
    }

    // Apply search filter
    if (searchQuery) {
      filteredPlayers = filteredPlayers.filter(player => 
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.country.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filteredPlayers = filteredPlayers.sort((a, b) => {
      const aValue = a[sortColumn as keyof typeof a];
      const bValue = b[sortColumn as keyof typeof b];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

    setPlayers(filteredPlayers);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [searchQuery, sortColumn, sortDirection, timeFilter]);

  // Calculate pagination
  const indexOfLastPlayer = currentPage * playersPerPage;
  const indexOfFirstPlayer = indexOfLastPlayer - playersPerPage;
  const currentPlayers = players.slice(indexOfFirstPlayer, indexOfLastPlayer);
  const totalPages = Math.ceil(players.length / playersPerPage);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      {/* Page header */}
      <div className="pt-24 pb-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold">Рейтинг игроков</h1>
          <p className="text-gray-400 mt-2">Лучшие игроки турниров FC25</p>
        </div>
      </div>
      
      {/* Search, filters and time period selector */}
      <div className="px-6 md:px-12 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-4 md:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search bar */}
                <div className="relative flex-grow">
                  <input
                    type="text"
                    placeholder="Поиск игроков..."
                    className="w-full bg-fc-background border border-fc-muted rounded-lg py-2 px-4 pl-10 text-white focus:outline-none focus:border-fc-accent"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search size={18} className="text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                </div>
                
                {/* Filters - simplified for now */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 flex items-center">
                    <Filter size={16} className="mr-1" />
                    Платформа:
                  </span>
                  <button className="px-3 py-1 rounded-full bg-fc-accent text-fc-background">
                    Все
                  </button>
                  <button className="px-3 py-1 rounded-full bg-fc-muted text-white hover:bg-fc-muted/80">
                    PS5
                  </button>
                  <button className="px-3 py-1 rounded-full bg-fc-muted text-white hover:bg-fc-muted/80">
                    Xbox
                  </button>
                  <button className="px-3 py-1 rounded-full bg-fc-muted text-white hover:bg-fc-muted/80">
                    PC
                  </button>
                </div>
              </div>
              
              {/* Time period filter */}
              <div className="border-t border-fc-muted pt-4">
                <RadioGroup 
                  defaultValue="alltime" 
                  className="flex flex-wrap gap-x-6 gap-y-2" 
                  value={timeFilter}
                  onValueChange={(value) => setTimeFilter(value as TimeFilter)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="24h" id="24h" className="border-fc-accent text-fc-accent" />
                    <Label htmlFor="24h" className="text-sm cursor-pointer">За 24 часа</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="week" id="week" className="border-fc-accent text-fc-accent" />
                    <Label htmlFor="week" className="text-sm cursor-pointer">За неделю</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="month" id="month" className="border-fc-accent text-fc-accent" />
                    <Label htmlFor="month" className="text-sm cursor-pointer">За месяц</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="alltime" id="alltime" className="border-fc-accent text-fc-accent" />
                    <Label htmlFor="alltime" className="text-sm cursor-pointer">За всё время</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Players table */}
      <div className="px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort('rank')} className="cursor-pointer hover:text-fc-accent">
                    <div className="flex items-center">
                      #
                      {sortColumn === 'rank' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Игрок</TableHead>
                  <TableHead onClick={() => handleSort('rating')} className="cursor-pointer hover:text-fc-accent">
                    <div className="flex items-center">
                      Рейтинг
                      {sortColumn === 'rating' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('wins')} className="cursor-pointer hover:text-fc-accent">
                    <div className="flex items-center">
                      Победы
                      {sortColumn === 'wins' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Винрейт</TableHead>
                  <TableHead className="hidden md:table-cell">Турниры</TableHead>
                  <TableHead className="hidden md:table-cell">Страна</TableHead>
                  <TableHead className="text-right">Изменение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPlayers.map((player) => (
                  <TableRow key={player.id} className="hover:bg-fc-muted/30">
                    <TableCell className="font-medium">
                      {player.rank <= 3 ? (
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          player.rank === 1 
                            ? 'bg-yellow-500' 
                            : player.rank === 2 
                              ? 'bg-gray-300' 
                              : 'bg-amber-700'
                        } text-fc-background font-bold`}>
                          {player.rank}
                        </div>
                      ) : (
                        <div className="text-gray-400 font-bold pl-3">{player.rank}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className={`relative w-10 h-10 rounded-full border-2 ${platformStyles[player.platform as keyof typeof platformStyles]} overflow-hidden mr-3`}>
                          <img 
                            src={player.avatar} 
                            alt={player.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium">
                            <a href={`/players/${player.id}`} className="hover:text-fc-accent transition-colors">
                              {player.name}
                            </a>
                          </div>
                          <div className="text-xs text-gray-400">{player.platform.toUpperCase()}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-fc-accent font-bold">
                        <Star size={14} className="mr-1" />
                        {player.rating}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Trophy size={14} className="text-fc-accent mr-1" />
                        {player.wins}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{player.winRate}</TableCell>
                    <TableCell className="hidden md:table-cell">{player.tournamentsPlayed}</TableCell>
                    <TableCell className="hidden md:table-cell">{player.country}</TableCell>
                    <TableCell className="text-right">
                      {player.change !== 0 && (
                        <div className={`inline-flex items-center ${player.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {player.change > 0 ? (
                            <ArrowUp size={14} className="mr-0.5" />
                          ) : (
                            <ArrowDown size={14} className="mr-0.5" />
                          )}
                          <span>{Math.abs(player.change)}</span>
                        </div>
                      )}
                      {player.change === 0 && (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-fc-muted">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(curr => Math.max(curr - 1, 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          isActive={currentPage === i + 1}
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(curr => Math.min(curr + 1, totalPages))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default RankingsPage;
