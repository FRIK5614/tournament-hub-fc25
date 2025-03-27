
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  searchForQuickTournament, 
  markUserAsReady, 
  leaveQuickTournament
} from '@/services/tournament';
import { fetchLobbyStatus, fetchLobbyParticipants } from './utils';
import { TournamentSearchState } from './types';
import { TournamentSearchAction, initialState } from './reducer';
import { useSearchActions } from './useSearchActions';
import { useReadyCheck } from './useReadyCheck';
import { useTournamentCreation } from './useTournamentCreation';

export const useTournamentSearch = () => {
  const [state, dispatch] = useState<TournamentSearchState>(initialState);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cleanupFunction, setCleanupFunction] = useState<(() => void) | null>(null);
  const cleanupFunctionRef = useRef(cleanupFunction);

  // Update the ref whenever cleanupFunction changes
  useEffect(() => {
    cleanupFunctionRef.current = cleanupFunction;
  }, [cleanupFunction]);

  // This function will be called when the component unmounts
  useEffect(() => {
    return () => {
      if (cleanupFunctionRef.current) {
        cleanupFunctionRef.current();
      }
    };
  }, []);

  const setupCleanupFunction = (cleanup: () => void) => {
    setCleanupFunction(() => cleanup);
  };

  const refreshLobbyData = useCallback(async (lobbyId: string) => {
    try {
      const lobbyStatus = await fetchLobbyStatus(lobbyId);
      dispatch(prevState => ({
        ...prevState,
        readyCheckActive: lobbyStatus.status === 'ready_check',
        countdownSeconds: 120
      }));

      const participants = await fetchLobbyParticipants(lobbyId);
      dispatch(prevState => ({
        ...prevState,
        lobbyParticipants: participants
      }));
    } catch (error) {
      console.error("Error refreshing lobby data:", error);
    }
  }, []);
  
  const { 
    handleStartSearch, 
    handleCancelSearch, 
    handleReadyCheck,
    isUserReady
  } = useSearchActions(
    state, 
    dispatch as unknown as React.Dispatch<TournamentSearchAction>, 
    setupCleanupFunction, 
    refreshLobbyData
  );
  
  // Return a Promise function for checkTournamentTrigger
  const triggerTournamentCheck = useCallback(async (): Promise<void> => {
    dispatch(prevState => ({
      ...prevState,
      checkTournamentTrigger: true
    }));
    return Promise.resolve();
  }, []);
  
  useReadyCheck(
    state, 
    dispatch as unknown as React.Dispatch<TournamentSearchAction>, 
    handleCancelSearch, 
    triggerTournamentCheck
  );
  
  const { checkTournamentCreation } = useTournamentCreation(
    state, 
    dispatch as unknown as React.Dispatch<TournamentSearchAction>, 
    handleCancelSearch
  );

  return {
    isSearching: state.isSearching,
    readyCheckActive: state.readyCheckActive,
    countdownSeconds: state.countdownSeconds,
    lobbyParticipants: state.lobbyParticipants || [],
    readyPlayers: state.readyPlayers || [],
    isLoading: state.isLoading,
    tournamentCreationStatus: state.tournamentCreationStatus || '',
    isCreatingTournament: state.isCreatingTournament,
    tournamentId: state.tournamentId,
    handleStartSearch,
    handleCancelSearch,
    handleReadyCheck,
    isUserReady,
    checkTournamentCreation
  };
};
