
export interface LobbyParticipant {
  id: string;
  user_id: string;
  lobby_id: string;
  status: string;
  is_ready: boolean;
  profile?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
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
  triggerTournamentCheck?: boolean;
  currentUserId: string | null; // Добавили новое поле
}
