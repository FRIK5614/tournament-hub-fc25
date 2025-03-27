
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TournamentSearchState } from './types';
import { TournamentSearchAction } from './reducer';
import { createTournamentWithRetry } from '@/services/tournament';
import { useCallback } from "react";

export const useTournamentCreation = (
  state: TournamentSearchState,
  dispatch: React.Dispatch<TournamentSearchAction>,
  handleCancelSearch: () => Promise<void>
) => {
  const { toast } = useToast();
  
  // Maximum number of creation attempts
  const MAX_CREATION_ATTEMPTS = 3;

  const checkTournamentCreation = useCallback(async (attempt = 0) => {
    try {
      if (state.isCreatingTournament || !state.lobbyId) {
        console.log("[TOURNAMENT-UI] Tournament creation already in progress or no lobby");
        return;
      }

      // Check authentication
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        console.error("[TOURNAMENT-UI] Authentication required:", authError);
        toast({
          title: "Требуется авторизация",
          description: "Для создания турнира необходимо авторизоваться",
          variant: "destructive",
        });
        return;
      }

      // Check if we should force create because timer expired, with reduced requirements
      const shouldForceCreate = state.countdownSeconds <= 0;
      // If timer expired, only require 1 ready player instead of 4
      const minRequiredReady = shouldForceCreate ? 1 : 4; 
      
      console.log(`[TOURNAMENT-UI] Current state: ready players=${state.readyPlayers.length}, total participants=${state.lobbyParticipants.length}, force=${shouldForceCreate}`);
      
      // Important: Always log the complete participant list to debug
      console.log("[TOURNAMENT-UI] Current participants:", state.lobbyParticipants.map(p => ({
        id: p.user_id,
        username: p.profile?.username,
        status: p.status,
        isReady: state.readyPlayers.includes(p.user_id)
      })));
      
      if (state.readyPlayers.length < minRequiredReady || state.lobbyParticipants.length < 4) {
        console.log(`[TOURNAMENT-UI] Not enough ready players or participants: ${state.readyPlayers.length}/${state.lobbyParticipants.length}, force: ${shouldForceCreate}`);
        
        // If timer expired but we have at least 4 players in lobby, proceed anyway
        if (shouldForceCreate && state.lobbyParticipants.length >= 4) {
          console.log(`[TOURNAMENT-UI] Timer expired, forcing tournament creation with ${state.readyPlayers.length} ready players out of ${state.lobbyParticipants.length}`);
        } else {
          return;
        }
      }

      console.log(`[TOURNAMENT-UI] Initiating tournament creation (attempt ${attempt + 1}/${MAX_CREATION_ATTEMPTS})`);
      dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: true });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'checking' });

      // Double-check that tournament hasn't already been created
      const { data: lobby, error: lobbyError } = await supabase
        .from('tournament_lobbies')
        .select('tournament_id, max_players, status, current_players')
        .eq('id', state.lobbyId)
        .maybeSingle();
        
      if (lobbyError) {
        console.error("[TOURNAMENT-UI] Error checking lobby status:", lobbyError);
        throw new Error("Не удалось проверить статус лобби");
      }
        
      if (lobby?.tournament_id) {
        console.log(`[TOURNAMENT-UI] Tournament already exists: ${lobby.tournament_id}`);
        dispatch({ type: 'SET_TOURNAMENT_ID', payload: lobby.tournament_id });
        dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
        return;
      }

      // If timer expired, force update player status to ready
      if (shouldForceCreate) {
        console.log("[TOURNAMENT-UI] Timer expired, updating all players to ready status");
        try {
          // Update all lobby participants to ready
          await supabase
            .from('lobby_participants')
            .update({ 
              is_ready: true,
              status: 'ready' 
            })
            .eq('lobby_id', state.lobbyId);
            
          // Force refresh the ready players list
          const { data: updatedParticipants } = await supabase
            .from('lobby_participants')
            .select('user_id, is_ready, status')
            .eq('lobby_id', state.lobbyId)
            .in('status', ['ready']);
            
          if (updatedParticipants && updatedParticipants.length > 0) {
            console.log(`[TOURNAMENT-UI] Updated ${updatedParticipants.length} players to ready status`);
            
            // Dispatch the updated ready players
            const readyPlayerIds = updatedParticipants.map(p => p.user_id);
            dispatch({ type: 'SET_READY_PLAYERS', payload: readyPlayerIds });
          }
        } catch (updateError) {
          console.error("[TOURNAMENT-UI] Error updating players ready status:", updateError);
          // Continue with tournament creation anyway
        }
      }

      // Critical fix: Explicitly check for current_players in database, not relying only on local state
      const { data: participantCount, error: countError } = await supabase
        .from('lobby_participants')
        .select('id, user_id, status')
        .eq('lobby_id', state.lobbyId)
        .in('status', ['searching', 'ready']);
        
      if (countError) {
        console.error("[TOURNAMENT-UI] Error counting participants:", countError);
      }
      
      const actualPlayerCount = participantCount ? participantCount.length : 0;
      console.log(`[TOURNAMENT-UI] Actual player count in database: ${actualPlayerCount}`);
      
      // Critical check: Only proceed if we truly have enough players
      if (actualPlayerCount < 4) {
        console.log(`[TOURNAMENT-UI] Not enough players to create tournament: ${actualPlayerCount}/4`);
        
        // Fix: Update the UI to show the actual player count
        if (state.lobbyParticipants.length !== actualPlayerCount) {
          console.log(`[TOURNAMENT-UI] Correcting UI player count from ${state.lobbyParticipants.length} to ${actualPlayerCount}`);
          
          // Refetch participants to sync UI with database
          const { data: refreshedParticipants } = await supabase
            .from('lobby_participants')
            .select('*, profile:profiles(*)')
            .eq('lobby_id', state.lobbyId)
            .in('status', ['searching', 'ready']);
            
          if (refreshedParticipants) {
            dispatch({ type: 'SET_LOBBY_PARTICIPANTS', payload: refreshedParticipants });
          }
        }
        
        // Last resort: try to add current user to lobby if needed
        if (authData.user && actualPlayerCount < 4) {
          const currentUserId = authData.user.id;
          const isUserInLobby = participantCount?.some(p => p.user_id === currentUserId);
          
          if (!isUserInLobby) {
            console.log("[TOURNAMENT-UI] Attempting to add current user to lobby");
            try {
              await supabase
                .from('lobby_participants')
                .insert({
                  lobby_id: state.lobbyId,
                  user_id: currentUserId,
                  status: 'ready',
                  is_ready: true
                });
                
              // Refetch participants after adding current user
              const { data: updatedParticipants } = await supabase
                .from('lobby_participants')
                .select('id, user_id, status')
                .eq('lobby_id', state.lobbyId)
                .in('status', ['searching', 'ready']);
                
              const newCount = updatedParticipants?.length || 0;
              
              if (newCount >= 4) {
                console.log(`[TOURNAMENT-UI] Successfully added current user, now have ${newCount} players. Continuing...`);
              } else {
                dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
                dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
                
                toast({
                  title: "Недостаточно игроков",
                  description: `Для создания турнира требуется 4 игрока, сейчас только ${newCount}`,
                  variant: "destructive",
                });
                
                if (attempt < MAX_CREATION_ATTEMPTS - 1) {
                  setTimeout(() => checkTournamentCreation(attempt + 1), 2000);
                } else {
                  await handleCancelSearch();
                }
                
                return;
              }
            } catch (addError) {
              console.error("[TOURNAMENT-UI] Error adding current user to lobby:", addError);
            }
          }
        } else {
          dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
          
          toast({
            title: "Недостаточно игроков",
            description: `Для создания турнира требуется 4 игрока, сейчас только ${actualPlayerCount}`,
            variant: "destructive",
          });
          
          if (attempt < MAX_CREATION_ATTEMPTS - 1) {
            // Retry after a delay
            console.log(`[TOURNAMENT-UI] Retrying tournament creation in 2 seconds...`);
            
            setTimeout(() => {
              checkTournamentCreation(attempt + 1);
            }, 2000);
          } else {
            console.log(`[TOURNAMENT-UI] Max creation attempts (${MAX_CREATION_ATTEMPTS}) reached. Giving up.`);
            
            toast({
              title: "Ошибка создания турнира",
              description: "Не удалось создать турнир из-за недостаточного количества игроков",
              variant: "destructive",
            });
            
            await handleCancelSearch();
          }
          
          return;
        }
      }

      // Create tournament
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'creating' });
      
      try {
        console.log("[TOURNAMENT-UI] Creating tournament for lobby:", state.lobbyId);
        const result = await createTournamentWithRetry(state.lobbyId);
        
        if (result.created) {
          console.log(`[TOURNAMENT-UI] Tournament created successfully with ID: ${result.tournamentId}`);
          
          // Double-check if the lobby was properly updated with the tournament_id
          const { data: updatedLobby } = await supabase
            .from('tournament_lobbies')
            .select('tournament_id')
            .eq('id', state.lobbyId)
            .single();
            
          if (updatedLobby?.tournament_id) {
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: updatedLobby.tournament_id });
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
            
            toast({
              title: "Турнир создан!",
              description: "Подготовка к началу турнира...",
              variant: "default",
            });
          } else if (result.tournamentId) {
            // If tournament ID is in the response but not in the lobby, manually update the lobby
            console.log(`[TOURNAMENT-UI] Manually updating lobby with tournament ID: ${result.tournamentId}`);
            
            await supabase
              .from('tournament_lobbies')
              .update({ 
                tournament_id: result.tournamentId,
                status: 'active',
                started_at: new Date().toISOString()
              })
              .eq('id', state.lobbyId);
              
            dispatch({ type: 'SET_TOURNAMENT_ID', payload: result.tournamentId });
            dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          }
        } else if (result.tournamentId) {
          // Турнир уже существовал
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: result.tournamentId });
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          
          toast({
            title: "Турнир уже создан",
            description: "Переход к началу турнира...",
            variant: "default",
          });
        } else {
          throw new Error("Не удалось создать турнир на сервере (нет tournament_id)");
        }
      } catch (error: any) {
        console.error("[TOURNAMENT-UI] Error creating tournament:", error);
        dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'failed' });
        
        // Check if tournament was created despite the error
        const { data: checkLobby } = await supabase
          .from('tournament_lobbies')
          .select('tournament_id')
          .eq('id', state.lobbyId)
          .maybeSingle();
          
        if (checkLobby?.tournament_id) {
          console.log(`[TOURNAMENT-UI] Found tournament ID after error: ${checkLobby.tournament_id}`);
          dispatch({ type: 'SET_TOURNAMENT_ID', payload: checkLobby.tournament_id });
          dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'created' });
          return;
        }
        
        // If not the last attempt, retry tournament creation
        if (attempt < MAX_CREATION_ATTEMPTS - 1) {
          console.log(`[TOURNAMENT-UI] Retrying tournament creation in 3 seconds (attempt ${attempt + 1}/${MAX_CREATION_ATTEMPTS})`);
          
          setTimeout(() => {
            checkTournamentCreation(attempt + 1);
          }, 3000);
        } else {
          // Maximum attempts reached
          console.log(`[TOURNAMENT-UI] Max creation attempts (${MAX_CREATION_ATTEMPTS}) reached. Giving up.`);
          
          toast({
            title: "Ошибка создания турнира",
            description: error.message || "Не удалось создать турнир после нескольких попыток. Попробуйте снова позже.",
            variant: "destructive",
          });
          
          dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
          await handleCancelSearch();
        }
      }
    } catch (error: any) {
      console.error("[TOURNAMENT-UI] Error in checkTournamentCreation:", error);
      
      dispatch({ type: 'SET_IS_CREATING_TOURNAMENT', payload: false });
      dispatch({ type: 'SET_TOURNAMENT_CREATION_STATUS', payload: 'error' });
      
      toast({
        title: "Ошибка создания турнира",
        description: error.message || "Произошла ошибка при проверке создания турнира",
        variant: "destructive",
      });
      
      // If not last attempt, retry
      if (attempt < MAX_CREATION_ATTEMPTS - 1) {
        console.log(`[TOURNAMENT-UI] Retrying after error in 3 seconds (attempt ${attempt + 1}/${MAX_CREATION_ATTEMPTS})`);
        
        setTimeout(() => {
          checkTournamentCreation(attempt + 1);
        }, 3000);
      } else {
        await handleCancelSearch();
      }
    }
  }, [
    state.isCreatingTournament, 
    state.lobbyId, 
    state.readyPlayers.length, 
    state.lobbyParticipants.length,
    state.countdownSeconds,
    toast,
    handleCancelSearch
  ]);

  return { checkTournamentCreation };
};
