
export interface LobbyParticipant {
  id: string; 
  user_id: string;
  lobby_id: string;
  status: 'searching' | 'ready' | 'left';
  is_ready: boolean;
  profile?: {
    id?: string;
    username?: string;
    avatar_url?: string | null;
  } | null;
}

export interface TournamentSearchState {
  currentUserId: string | null;
  lobbyId: string | null;
  isSearching: boolean;
  readyCheckActive: boolean;
  countdownSeconds: number;
  lobbyParticipants: LobbyParticipant[];
  readyPlayers: string[];
  isLoading: boolean;
  tournamentCreationStatus: string;
  isCreatingTournament: boolean;
  tournamentId: string | null;
  searchAttempts: number;
  creationAttempts: number;
  checkTournamentTrigger: boolean;
}
