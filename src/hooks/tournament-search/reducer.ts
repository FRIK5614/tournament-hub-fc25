
import { TournamentSearchState } from './types';

export type TournamentSearchAction =
  | { type: 'SET_SEARCHING'; payload: boolean }
  | { type: 'SET_LOBBY_ID'; payload: string | null }
  | { type: 'SET_READY_CHECK_ACTIVE'; payload: boolean }
  | { type: 'SET_COUNTDOWN_SECONDS'; payload: number }
  | { type: 'SET_LOBBY_PARTICIPANTS'; payload: TournamentSearchState['lobbyParticipants'] }
  | { type: 'SET_READY_PLAYERS'; payload: string[] }
  | { type: 'SET_SEARCH_ATTEMPTS'; payload: number }
  | { type: 'SET_CURRENT_USER_ID'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CREATING_TOURNAMENT'; payload: boolean }
  | { type: 'SET_TOURNAMENT_CREATION_STATUS'; payload: string }
  | { type: 'SET_CREATION_ATTEMPTS'; payload: number }
  | { type: 'ADD_READY_PLAYER'; payload: string }
  | { type: 'RESET_SEARCH' };

export const initialState: TournamentSearchState = {
  isSearching: false,
  lobbyId: null,
  readyCheckActive: false,
  countdownSeconds: 30,
  lobbyParticipants: [],
  readyPlayers: [],
  searchAttempts: 0,
  currentUserId: null,
  isLoading: false,
  isCreatingTournament: false,
  tournamentCreationStatus: '',
  creationAttempts: 0,
};

export function tournamentSearchReducer(
  state: TournamentSearchState,
  action: TournamentSearchAction
): TournamentSearchState {
  switch (action.type) {
    case 'SET_SEARCHING':
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
    case 'SET_SEARCH_ATTEMPTS':
      return { ...state, searchAttempts: action.payload };
    case 'SET_CURRENT_USER_ID':
      return { ...state, currentUserId: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_CREATING_TOURNAMENT':
      return { ...state, isCreatingTournament: action.payload };
    case 'SET_TOURNAMENT_CREATION_STATUS':
      return { ...state, tournamentCreationStatus: action.payload };
    case 'SET_CREATION_ATTEMPTS':
      return { ...state, creationAttempts: action.payload };
    case 'ADD_READY_PLAYER':
      if (state.readyPlayers.includes(action.payload)) {
        return state;
      }
      return { 
        ...state, 
        readyPlayers: [...state.readyPlayers, action.payload] 
      };
    case 'RESET_SEARCH':
      return { 
        ...initialState,
        currentUserId: state.currentUserId
      };
    default:
      return state;
  }
}
