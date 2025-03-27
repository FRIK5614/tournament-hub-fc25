
import { supabase } from '@/integrations/supabase/client';
import { LobbyParticipant } from './types';

/**
 * Fetch status for a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('status, current_players, max_players, tournament_id')
    .eq('id', lobbyId)
    .single();
  
  if (error) {
    console.error("[TOURNAMENT-UI] Error fetching lobby status:", error);
    throw error;
  }
  
  return data || { status: 'waiting', current_players: 0, max_players: 4, tournament_id: null };
};

/**
 * Fetch participants in a tournament lobby
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  try {
    // First fetch participants
    const { data: participantsData, error: participantsError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, lobby_id, is_ready, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
    
    if (participantsError) {
      console.error("[TOURNAMENT-UI] Error fetching lobby participants:", participantsError);
      throw participantsError;
    }
    
    if (!participantsData || participantsData.length === 0) {
      return [];
    }
    
    // Then fetch profiles separately to avoid relation issues
    const userIds = participantsData.map(p => p.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    if (profilesError) {
      console.error("[TOURNAMENT-UI] Error fetching profiles:", profilesError);
      // Return participants without profile data rather than failing
      return participantsData.map(p => ({
        ...p,
        profile: { username: 'Unknown', avatar_url: null }
      }));
    }
    
    // Merge participant data with profile data
    const participants: LobbyParticipant[] = participantsData.map(participant => {
      const profile = profilesData?.find(p => p.id === participant.user_id);
      return {
        ...participant,
        profile: profile ? { 
          username: profile.username || 'Unknown', 
          avatar_url: profile.avatar_url 
        } : { 
          username: 'Unknown', 
          avatar_url: null 
        }
      };
    });
    
    return participants;
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchLobbyParticipants:", error);
    return [];
  }
};

/**
 * Fetch players who are marked as ready
 */
export const fetchReadyPlayers = async (lobbyId: string): Promise<string[]> => {
  try {
    // First try to get participants with is_ready=true
    const { data: readyData, error: readyError } = await supabase
      .from('lobby_participants')
      .select('user_id')
      .eq('lobby_id', lobbyId)
      .eq('is_ready', true)
      .eq('status', 'ready');
      
    if (readyError) {
      console.error("[TOURNAMENT-UI] Error fetching ready players:", readyError);
      throw readyError;
    }
    
    // Map the ready participants to an array of user IDs
    return (readyData || []).map(p => p.user_id);
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in fetchReadyPlayers:", error);
    throw error;
  }
};

/**
 * Force-update status of lobby participants to ensure consistency
 */
export const ensureParticipantStatus = async (lobbyId: string) => {
  try {
    // First check if this lobby is in ready_check mode
    const { data: lobby, error: lobbyError } = await supabase
      .from('tournament_lobbies')
      .select('status')
      .eq('id', lobbyId)
      .single();
      
    if (lobbyError) {
      console.error("[TOURNAMENT-UI] Error checking lobby status:", lobbyError);
      return;
    }
    
    // If lobby is in ready_check mode, ensure all participants have status 'ready'
    if (lobby?.status === 'ready_check') {
      const { data: participants, error: participantsError } = await supabase
        .from('lobby_participants')
        .select('id, status')
        .eq('lobby_id', lobbyId)
        .eq('status', 'searching');
        
      if (participantsError) {
        console.error("[TOURNAMENT-UI] Error fetching participants to update:", participantsError);
        return;
      }
      
      // Force-update any participants still in 'searching' status to 'ready'
      if (participants && participants.length > 0) {
        console.log(`[TOURNAMENT-UI] Found ${participants.length} participants that need status update to 'ready'`);
        
        const { error: updateError } = await supabase
          .from('lobby_participants')
          .update({ status: 'ready' })
          .eq('lobby_id', lobbyId)
          .eq('status', 'searching');
          
        if (updateError) {
          console.error("[TOURNAMENT-UI] Error updating participant statuses:", updateError);
        } else {
          console.log('[TOURNAMENT-UI] Successfully updated participant statuses to ready');
        }
      }
    }
  } catch (error) {
    console.error("[TOURNAMENT-UI] Error in ensureParticipantStatus:", error);
  }
};
