
export interface LobbyParticipant {
  id: string;
  user_id: string;
  status: string;
  is_ready: boolean;
  lobby_id: string;
  profile?: {
    id: string;
    username: string;
    avatar_url?: string | null;
  };
}

export interface LobbyStatus {
  status: string;
  current_players: number;
  max_players: number;
  ready_check_started_at?: string | null;
  tournament_id?: string | null;
}

export interface TournamentSearchState {
  isSearching: boolean;
  lobbyId: string | null;
  readyCheckActive: boolean;
  countdownSeconds: number;
  lobbyParticipants: LobbyParticipant[];
  readyPlayers: string[];
  isLoading: boolean;
  tournamentCreationStatus: string;
  isCreatingTournament: boolean;
  tournamentId: string | null;
  currentUserId: string | null;
  searchAttempts: number;
  triggerTournamentCheck?: boolean;
}
