
export interface LobbyParticipant {
  id: string;
  user_id: string;
  lobby_id: string;
  is_ready: boolean;
  status: string;
  profile?: {
    username: string;
    avatar_url: string | null;
  };
}

export interface TournamentSearchState {
  isSearching: boolean;
  lobbyId: string | null;
  readyCheckActive: boolean;
  countdownSeconds: number;
  lobbyParticipants: LobbyParticipant[];
  readyPlayers: string[];
  searchAttempts: number;
  currentUserId: string | null;
  isLoading: boolean;
  isCreatingTournament: boolean;
  tournamentCreationStatus: string;
  creationAttempts: number;
  checkTournamentTrigger: boolean;
  tournamentId: string | null;
}

export interface TournamentSearchActions {
  handleStartSearch: (isRetry?: boolean) => Promise<void>;
  handleCancelSearch: () => Promise<void>;
  handleReadyCheck: () => Promise<void>;
  isUserReady: () => boolean;
}

export interface UseTournamentSearchResult extends Omit<TournamentSearchState, 'searchAttempts' | 'creationAttempts' | 'checkTournamentTrigger'>, TournamentSearchActions {}
