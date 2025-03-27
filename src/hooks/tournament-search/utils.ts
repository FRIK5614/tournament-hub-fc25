
import { supabase } from "@/integrations/supabase/client";
import { LobbyParticipant } from "./types";

/**
 * Fetch the status of a tournament lobby
 */
export const fetchLobbyStatus = async (lobbyId: string) => {
  const { data, error } = await supabase
    .from('tournament_lobbies')
    .select('status, current_players, max_players, tournament_id')
    .eq('id', lobbyId)
    .single();
    
  if (error) {
    console.error('[TOURNAMENT-UI] Error fetching lobby status:', error);
    throw error;
  }
  
  return data;
};

/**
 * Fetch participants in a tournament lobby
 */
export const fetchLobbyParticipants = async (lobbyId: string): Promise<LobbyParticipant[]> => {
  const { data, error } = await supabase
    .from('lobby_participants')
    .select(`
      id, 
      user_id, 
      lobby_id,
      status, 
      is_ready,
      profile:profiles(id, username, avatar_url)
    `)
    .eq('lobby_id', lobbyId)
    .in('status', ['searching', 'ready']);
    
  if (error) {
    console.error('[TOURNAMENT-UI] Error fetching lobby participants:', error);
    throw error;
  }
  
  console.log(`[TOURNAMENT-UI] Found ${data?.length || 0} participants for lobby ${lobbyId}`, data);
  
  // Process the data to ensure it matches the LobbyParticipant type
  return parseLobbyParticipants(data || []);
};

/**
 * Parse participants data to match LobbyParticipant type
 */
export const parseLobbyParticipants = (participants: any[]): LobbyParticipant[] => {
  return participants.map(participant => {
    const profile = participant.profile;
    const hasValidProfile = profile && 
                           typeof profile === 'object' && 
                           profile !== null;
    
    // Debug information for profile parsing
    console.log("[TOURNAMENT-UI] Parsing participant:", {
      id: participant.id, 
      userId: participant.user_id,
      hasProfile: !!profile,
      profileType: profile ? typeof profile : 'undefined',
      profileIsNull: profile === null,
      profileData: profile
    });
    
    return {
      id: participant.id,
      user_id: participant.user_id,
      lobby_id: participant.lobby_id,
      status: participant.status || 'searching',
      is_ready: participant.is_ready || false,
      profile: {
        username: hasValidProfile && profile && 'username' in (profile as Record<string, any>)
                 ? String((profile as Record<string, any>).username || 'Unknown Player')
                 : 'Unknown Player',
        avatar_url: hasValidProfile && profile && 'avatar_url' in (profile as Record<string, any>)
                   ? ((profile as Record<string, any>).avatar_url as string | null) || null
                   : null
      }
    };
  });
};

/**
 * Ensure participants have correct status during ready check
 */
export const ensureParticipantStatus = async (participants: LobbyParticipant[], lobbyId: string) => {
  try {
    // Get participants that are in 'searching' status
    const searchingParticipants = participants.filter(p => p.status === 'searching');
    
    if (searchingParticipants.length > 0) {
      console.log(`[TOURNAMENT-UI] Fixing ${searchingParticipants.length} participants with 'searching' status during ready check`);
      
      // Update all searching participants to 'ready' status
      for (const participant of searchingParticipants) {
        await supabase
          .from('lobby_participants')
          .update({ status: 'ready' })
          .eq('id', participant.id)
          .eq('lobby_id', lobbyId);
      }
      
      console.log('[TOURNAMENT-UI] Fixed participant statuses for ready check');
    }
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error ensuring participant status:', error);
  }
};

/**
 * Enrich participants with profile data if missing
 */
export const enrichParticipantsWithProfiles = async (participants: any[]): Promise<any[]> => {
  try {
    const participantsWithMissingProfiles = participants.filter(p => 
      !p.profile || 
      typeof p.profile !== 'object' || 
      p.profile === null ||
      p.profile.error || 
      !('username' in p.profile)
    );
    
    if (participantsWithMissingProfiles.length === 0) {
      return participants;
    }
    
    console.log(`[TOURNAMENT-UI] Enriching ${participantsWithMissingProfiles.length} participants with missing profile data`);
    
    const userIds = participantsWithMissingProfiles.map(p => p.user_id);
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
      
    if (error) {
      console.error('[TOURNAMENT-UI] Error fetching profiles:', error);
      return participants;
    }
    
    // Create a map of user ID to profile
    const profileMap = new Map();
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile);
    });
    
    // Enrich participants with profile data
    return participants.map(participant => {
      const hasValidProfile = participant.profile && 
                             typeof participant.profile === 'object' && 
                             participant.profile !== null &&
                             !participant.profile.error && 
                             'username' in participant.profile;
      
      if (hasValidProfile) {
        return participant;
      }
      
      const profile = profileMap.get(participant.user_id);
      return {
        ...participant,
        profile: profile || {
          username: 'Unknown Player',
          avatar_url: null
        }
      };
    });
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error enriching profiles:', error);
    return participants;
  }
};

/**
 * Update the current player count for a lobby
 */
export const updateLobbyPlayerCount = async (lobbyId: string) => {
  if (!lobbyId) {
    console.error('[TOURNAMENT-UI] Cannot update player count: No lobby ID provided');
    return;
  }
  
  try {
    // Add a delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Count active participants in lobby
    const { data: participants, error: countError } = await supabase
      .from('lobby_participants')
      .select('id, user_id, status')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    if (countError) {
      console.error('[TOURNAMENT-UI] Error counting participants:', countError);
      return;
    }
    
    const count = participants?.length || 0;
    
    console.log(`[TOURNAMENT-UI] Updating lobby ${lobbyId} player count to ${count}`);
    console.log('[TOURNAMENT-UI] Participants found:', participants);
    
    // Get current state of the lobby
    const { data: lobbyData } = await supabase
      .from('tournament_lobbies')
      .select('current_players, status')
      .eq('id', lobbyId)
      .single();
      
    console.log(`[TOURNAMENT-UI] Current lobby state:`, lobbyData);
    
    // Update the lobby's current_players count
    const { error: updateError } = await supabase
      .from('tournament_lobbies')
      .update({ current_players: count })
      .eq('id', lobbyId);
      
    if (updateError) {
      console.error('[TOURNAMENT-UI] Error updating lobby player count:', updateError);
      return;
    }
    
    console.log(`[TOURNAMENT-UI] Updated lobby ${lobbyId} player count to ${count}`);
    
    // If we have 4 players, check if we need to update status to ready_check
    if (count === 4) {
      const { data: lobby } = await supabase
        .from('tournament_lobbies')
        .select('status')
        .eq('id', lobbyId)
        .single();
        
      if (lobby?.status === 'waiting') {
        console.log(`[TOURNAMENT-UI] Lobby ${lobbyId} has 4 players, updating to ready_check`);
        
        await supabase
          .from('tournament_lobbies')
          .update({ 
            status: 'ready_check', 
            ready_check_started_at: new Date().toISOString() 
          })
          .eq('id', lobbyId)
          .eq('status', 'waiting');
      }
    }
    
    // Re-fetch participants to sync UI
    const { data: updatedParticipants } = await supabase
      .from('lobby_participants')
      .select(`
        id, 
        user_id, 
        lobby_id,
        status, 
        is_ready,
        profile:profiles(id, username, avatar_url)
      `)
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
      
    console.log(`[TOURNAMENT-UI] After update: ${updatedParticipants?.length || 0} participants`);
    
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error in updateLobbyPlayerCount:', error);
  }
};

// New helper function to reset the state of the lobby for debugging purposes
export const resetLobbyForDebugging = async (lobbyId: string) => {
  try {
    console.log(`[TOURNAMENT-UI] Attempting to reset lobby ${lobbyId} for debugging`);
    
    // Update lobby status back to waiting
    await supabase
      .from('tournament_lobbies')
      .update({ 
        status: 'waiting', 
        ready_check_started_at: null,
        current_players: 0
      })
      .eq('id', lobbyId);
      
    console.log(`[TOURNAMENT-UI] Lobby status reset to waiting`);
    
    // Refresh the actual player count
    await updateLobbyPlayerCount(lobbyId);
    
    return true;
  } catch (error) {
    console.error('[TOURNAMENT-UI] Error resetting lobby:', error);
    return false;
  }
};
