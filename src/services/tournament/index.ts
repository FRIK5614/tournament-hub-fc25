
// Экспортируем все сервисы, связанные с турнирами
export * from './matchService';
export * from './lobby/index';

// Re-export from tournamentService with explicit names to avoid conflicts
export {
  getTournamentStandings,
  getPlayerMatches,
  registerForLongTermTournament,
  getLongTermTournaments,
  cleanupDuplicateTournaments,
  analyzeTournamentCreation
} from './tournamentService';

// Экспортируем типы
export interface Tournament {
  id: string;
  title: string;
  description?: string;
  status: 'registration' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  max_participants: number;
  current_participants: number;
  prize_pool?: string;
  tournament_format: 'quick' | 'conference' | 'europa' | 'champions';
  lobby_id?: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  status: 'scheduled' | 'awaiting_confirmation' | 'completed';
  player1_score?: number;
  player2_score?: number;
  winner_id?: string;
  created_at: string;
  completed_time?: string;
  player1?: {
    id: string;
    username: string;
    avatar_url?: string;
    rating?: number;
  };
  player2?: {
    id: string;
    username: string;
    avatar_url?: string;
    rating?: number;
  };
}

export interface TournamentStanding {
  id: string;
  user_id: string;
  tournament_id: string;
  points: number;
  status: string;
  position?: number;
  user?: {
    id: string;
    username: string;
    avatar_url?: string;
    rating?: number;
  };
}
