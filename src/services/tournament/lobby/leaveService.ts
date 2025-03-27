
import { supabase } from "@/integrations/supabase/client";
import { updateLobbyPlayerCount } from "../utils";
import { handlePlayerLeaveFromReadyCheck } from "./readyCheckService";

/**
 * Have a user leave a quick tournament lobby
 */
export const leaveQuickTournament = async (lobbyId: string) => {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error("Пользователь не авторизован");
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} leaving lobby ${lobbyId}`);
    
    // Проверяем текущий статус лобби перед выходом
    const { data: lobby } = await supabase
      .from('tournament_lobbies')
      .select('status')
      .eq('id', lobbyId)
      .maybeSingle();
    
    // Получаем текущее количество игроков
    const { data: participants } = await supabase
      .from('lobby_participants')
      .select('id, user_id')
      .eq('lobby_id', lobbyId)
      .in('status', ['searching', 'ready']);
    
    const currentPlayerCount = participants?.length || 0;
    
    // Обновляем статус игрока на "вышел"
    await supabase
      .from('lobby_participants')
      .update({ status: 'left', is_ready: false })
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.user.id);
    
    // Если лобби в состоянии ready_check, обрабатываем это специальным образом
    if (lobby?.status === 'ready_check') {
      await handlePlayerLeaveFromReadyCheck(lobbyId);
    } else {
      // Для других статусов просто обновляем счетчик игроков
      await updateLobbyPlayerCount(lobbyId);
    }
    
    console.log(`[TOURNAMENT] User ${user.user.id} successfully left lobby ${lobbyId}`);
    return { success: true };
  } catch (error) {
    console.error("[TOURNAMENT] Error leaving tournament:", error);
    throw error;
  }
};
