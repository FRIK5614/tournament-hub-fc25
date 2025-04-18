
import { TournamentSearchState } from './types';

export type TournamentSearchAction =
  | { type: 'SET_IS_SEARCHING'; payload: boolean }
  | { type: 'SET_LOBBY_ID'; payload: string | null }
  | { type: 'SET_READY_CHECK_ACTIVE'; payload: boolean }
  | { type: 'SET_COUNTDOWN_SECONDS'; payload: number }
  | { type: 'SET_LOBBY_PARTICIPANTS'; payload: any[] }
  | { type: 'SET_READY_PLAYERS'; payload: string[] }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_TOURNAMENT_CREATION_STATUS'; payload: string }
  | { type: 'SET_IS_CREATING_TOURNAMENT'; payload: boolean }
  | { type: 'SET_TOURNAMENT_ID'; payload: string | null }
  | { type: 'TRIGGER_TOURNAMENT_CHECK'; payload: boolean }
  | { type: 'SET_CURRENT_USER_ID'; payload: string | null }
  | { type: 'RESET_SEARCH' }
  | { type: 'ADD_READY_PLAYER'; payload: string }
  | { type: 'SET_SEARCH_ATTEMPTS'; payload: number };

export const initialState: TournamentSearchState = {
  isSearching: false,
  lobbyId: null,
  readyCheckActive: false,
  countdownSeconds: 120,
  lobbyParticipants: [],
  readyPlayers: [],
  isLoading: false,
  tournamentCreationStatus: '',
  isCreatingTournament: false,
  tournamentId: null,
  currentUserId: null,
  searchAttempts: 0,
};

export const tournamentSearchReducer = (
  state: TournamentSearchState,
  action: TournamentSearchAction
): TournamentSearchState => {
  switch (action.type) {
    case 'SET_IS_SEARCHING':
      return { ...state, isSearching: action.payload };
    case 'SET_LOBBY_ID':
      return { ...state, lobbyId: action.payload };
    case 'SET_READY_CHECK_ACTIVE':
      return { ...state, readyCheckActive: action.payload };
    case 'SET_COUNTDOWN_SECONDS':
      return { ...state, countdownSeconds: action.payload };
    case 'SET_LOBBY_PARTICIPANTS':
      return { ...state, lobbyParticipants: action.payload };
    case 'SET_READY_PLAYERS':
      return { ...state, readyPlayers: action.payload };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_TOURNAMENT_CREATION_STATUS':
      return { ...state, tournamentCreationStatus: action.payload };
    case 'SET_IS_CREATING_TOURNAMENT':
      return { ...state, isCreatingTournament: action.payload };
    case 'SET_TOURNAMENT_ID':
      return { ...state, tournamentId: action.payload };
    case 'TRIGGER_TOURNAMENT_CHECK':
      return { ...state, triggerTournamentCheck: action.payload };
    case 'SET_CURRENT_USER_ID':
      return { ...state, currentUserId: action.payload };
    case 'RESET_SEARCH':
      return {
        ...initialState,
        currentUserId: state.currentUserId, // Keep the user ID
        searchAttempts: state.searchAttempts // Keep the search attempts count
      };
    case 'ADD_READY_PLAYER':
      return {
        ...state,
        readyPlayers: [...state.readyPlayers, action.payload]
      };
    case 'SET_SEARCH_ATTEMPTS':
      return { ...state, searchAttempts: action.payload };
    default:
      return state;
  }
};
