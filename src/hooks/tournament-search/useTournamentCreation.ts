
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { TournamentSearchState } from './types';
import { TournamentSearchAction } from './reducer';
import { supabase } from "@/integrations/supabase/client";

export function useTournamentCreation(
  state: TournamentSearchState,
  dispatch: React.Dispatch<TournamentSearchAction>,
  handleCancelSearch: () => Promise<void>
) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const maxCreationAttempts = 3;
  const creationAttemptsRef = useRef(0);
  
  // Monitor for the trigger to check tournament creation
  useEffect(() => {
    if (state.checkTournamentTrigger && !state.isCreatingTournament) {
      checkTournamentCreation();
      // Reset the trigger
      dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: false });
    }
  }, [state.checkTournamentTrigger]);
  
  // If we have a tournament ID, navigate to it
  useEffect(() => {
    if (state.tournamentId) {
      console.log(`[TOURNAMENT-UI] Tournament ID is set, navigating to /tournaments/${state.tournamentId}`);
      
      toast({
        title: "Турнир начинается!",
        description: "Все игроки готовы. Переход к турниру...",
        variant: "default",
      });
      
      // Short delay before navigation
      setTimeout(() => {
        navigate(`/tournaments/${state.tournamentId}`);
      }, 1000);
    }
  }, [state.tournamentId, navigate, toast]);
  
  // Setup direct subscription to tournament_id changes on the lobby
  useEffect(() => {
    if (!state.lobbyId) return;
    
    console.log(`[TOURNAMENT-UI] Setting up subscription for tournament creation on lobby ${state.lobbyId}`);
    
    const channel = supabase
      .channel(`lobby_tournament_created_${state.lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_lobbies',
          filter: `id=eq.${state.lobbyId}`,
        },
        (payload) => {
          console.log('[TOURNAMENT-UI] Lobby updated:', payload);
          if (payload.new?.tournament_id && !state.tournamentId) {
            console.log(`[TOURNAMENT-UI] Tournament created: ${payload.new.tournament_id}`);
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: payload.new.tournament_id });
            
            // Mark tournament creation as complete
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
            dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
          }
        }
      )
      .subscribe();
      
    return () => {
      console.log(`[TOURNAMENT-UI] Cleaning up subscription for lobby ${state.lobbyId}`);
      supabase.removeChannel(channel);
    };
  }, [state.lobbyId, state.tournamentId, dispatch]);

  // Periodic check for tournament creation
  useEffect(() => {
    if (!state.lobbyId || state.tournamentId || !state.readyCheckActive) return;

    // Regular polling to check if tournament was created
    const checkForTournament = async () => {
      try {
        console.log(`[TOURNAMENT-UI] Polling for tournament ID on lobby ${state.lobbyId}`);
        
        const { data } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id, status')
          .eq('id', state.lobbyId)
          .maybeSingle();

        if (data?.tournament_id && !state.tournamentId) {
          console.log(`[TOURNAMENT-UI] Found tournament ID ${data.tournament_id} during polling`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: data.tournament_id });
          
          // Mark tournament creation as complete
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        }
        
        // Also check if all players are ready but tournament not created yet
        if (data?.status === 'ready_check' && !data?.tournament_id && state.lobbyParticipants.length === 4) {
          const allReady = state.lobbyParticipants.every(p => 
            state.readyPlayers.includes(p.user_id)
          );
          
          if (allReady && !state.isCreatingTournament) {
            console.log('[TOURNAMENT-UI] All players ready but no tournament, triggering creation');
            dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
          }
        }
      } catch (error) {
        console.error('[TOURNAMENT-UI] Error checking tournament:', error);
      }
    };

    const intervalId = setInterval(checkForTournament, 2000);
    return () => clearInterval(intervalId);
  }, [state.lobbyId, state.tournamentId, state.readyCheckActive, state.lobbyParticipants, state.readyPlayers, state.isCreatingTournament, dispatch]);
  
  const checkTournamentCreation = useCallback(async () => {
    const { lobbyId, isCreatingTournament, tournamentId } = state;
    
    if (!lobbyId || isCreatingTournament || tournamentId) return;
    
    console.log(`[TOURNAMENT-UI] Checking tournament creation for lobby ${lobbyId}`);
    
    try {
      dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: true });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'checking' });
      
      // First check if tournament already exists for this lobby
      const { data: existingLobby } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .single();
        
      if (existingLobby?.tournament_id) {
        console.log(`[TOURNAMENT-UI] Found existing tournament ${existingLobby.tournament_id}`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        dispatch({ type: 'SET_TOURNAMENT_ID', payload: existingLobby.tournament_id });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      // Verify all players are ready
      const { data: participants } = await supabase
        .from('lobby_participants')
        .select('user_id, is_ready')
        .eq('lobby_id', lobbyId)
        .in('status', ['ready', 'searching']);
        
      if (!participants || participants.length < 4) {
        console.log(`[TOURNAMENT-UI] Not enough ready players: ${participants?.length || 0}/4`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      const readyCount = participants.filter(p => p.is_ready).length;
      
      if (readyCount < 4) {
        console.log(`[TOURNAMENT-UI] Not all players ready: ${readyCount}/4`);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      console.log(`[TOURNAMENT-UI] All players are ready, attempting to create tournament`);
      
      // Try to create tournament by directly calling RPC
      try {
        await supabase.rpc('create_matches_for_quick_tournament', {
          lobby_id: lobbyId
        });
        
        console.log(`[TOURNAMENT-UI] Tournament creation RPC called successfully`);
        
        // Wait a moment and check if tournament was created
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: updatedLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .single();
          
        if (updatedLobby?.tournament_id) {
          console.log(`[TOURNAMENT-UI] Tournament created successfully: ${updatedLobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: updatedLobby.tournament_id });
          dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
          return;
        } else {
          console.log(`[TOURNAMENT-UI] RPC called but no tournament created yet`);
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'waiting' });
          
          // Increment creation attempts
          creationAttemptsRef.current += 1;
          
          if (creationAttemptsRef.current >= maxCreationAttempts) {
            console.log(`[TOURNAMENT-UI] Max attempts reached, forcing direct creation`);
            await forceCreateTournament(lobbyId);
          } else {
            // Schedule another check
            setTimeout(() => {
              dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
              dispatch({ type: 'TRIGGER_TOURNAMENT_CHECK', payload: true });
            }, 3000);
          }
        }
      } catch (error) {
        console.error("[TOURNAMENT-UI] Error calling tournament creation RPC:", error);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
        
        // Try direct creation instead
        await forceCreateTournament(lobbyId);
      }
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error in checkTournamentCreation:", error);
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
      
      // Try direct tournament creation
      await forceCreateTournament(lobbyId);
    }
  }, [state, dispatch, toast]);
  
  // Forcefully create tournament directly
  const forceCreateTournament = async (lobbyId: string) => {
    if (!lobbyId) return;
    
    try {
      console.log(`[TOURNAMENT-UI] Forcefully creating tournament for lobby ${lobbyId}`);
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'checking' });
      
      // Get participants
      const { data: participants } = await supabase
        .from('lobby_participants')
        .select('user_id, profile:profiles(username)')
        .eq('lobby_id', lobbyId)
        .in('status', ['ready', 'searching']);
        
      if (!participants || participants.length < 4) {
        console.error(`[TOURNAMENT-UI] Not enough participants for tournament: ${participants?.length || 0}`);
        toast({
          title: "Недостаточно игроков",
          description: "Для создания турнира необходимо 4 игрока.",
          variant: "destructive",
        });
        
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      // Check if tournament already exists first
      const { data: existingTournament } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id')
        .eq('id', lobbyId)
        .maybeSingle();
        
      if (existingTournament?.tournament_id) {
        console.log(`[TOURNAMENT-UI] Tournament already exists: ${existingTournament.tournament_id}`);
        dispatch({ type: 'SET_TOURNAMENT_ID', payload: existingTournament.tournament_id });
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
        return;
      }
      
      // Create tournament directly
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          title: 'Быстрый турнир',
          max_participants: 4,
          status: 'active',
          type: 'quick',
          tournament_format: 'quick',
          lobby_id: lobbyId,
          current_participants: 4
        })
        .select('id')
        .single();
        
      if (tournamentError) {
        console.error("[TOURNAMENT-UI] Error creating tournament directly:", tournamentError);
        
        // Check again if tournament was already created by someone else
        const { data: checkLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', lobbyId)
          .maybeSingle();
          
        if (checkLobby?.tournament_id) {
          console.log(`[TOURNAMENT-UI] Tournament was already created: ${checkLobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: checkLobby.tournament_id });
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
          return;
        }
        
        throw tournamentError;
      }
      
      console.log(`[TOURNAMENT-UI] Tournament created: ${tournament.id}`);
      
      // Update lobby with tournament ID
      await supabase
        .from('tournament_lobbies')
        .update({ 
          tournament_id: tournament.id, 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', lobbyId);
        
      // Add participants
      for (const participant of participants) {
        await supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournament.id,
            user_id: participant.user_id,
            status: 'active',
            points: 0
          });
      }
      
      // Create matches (round-robin)
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          await supabase
            .from('matches')
            .insert({
              tournament_id: tournament.id,
              player1_id: participants[i].user_id,
              player2_id: participants[j].user_id,
              status: 'scheduled'
            });
        }
      }
      
      toast({
        title: "Турнир создан",
        description: "Турнир успешно создан. Вы будете перенаправлены в лобби турнира.",
        variant: "default",
      });
      
      dispatch({ type: 'SET_TOURNAMENT_ID', payload: tournament.id });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
      dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
    } catch (error) {
      console.error("[TOURNAMENT-UI] Error in forceCreateTournament:", error);
      
      toast({
        title: "Ошибка создания турнира",
        description: "Не удалось создать турнир. Пожалуйста, попробуйте снова.",
        variant: "destructive",
      });
      
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
      dispatch({ type: 'SET_CREATING_TOURNAMENT', payload: false });
      
      setTimeout(() => {
        handleCancelSearch();
      }, 3000);
    }
  };
  
  return { checkTournamentCreation };
}
