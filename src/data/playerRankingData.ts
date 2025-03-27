
export interface PlayerData {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  platform: 'ps5' | 'xbox' | 'pc';
  wins: number;
  change: number;
  rank: number;
  country: string;
  winRate: string;
  tournamentsPlayed: number;
}

// Sample extended player data with more players
export const extendedPlayerData: PlayerData[] = [
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
