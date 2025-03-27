
import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface TournamentChatProps {
  tournamentId: string;
}

interface ChatMessage {
  id: string;
  created_at: string;
  message: string;
  user_id: string;
  tournament_id: string;
  user?: {
    username: string;
    avatar_url: string;
  };
}

const TournamentChat = ({ tournamentId }: TournamentChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Fetch chat messages and set up realtime subscription
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        setCurrentUser(userData?.user || null);
        
        // Get chat messages
        const { data, error } = await supabase
          .from('chat_messages')
          .select(`
            *,
            user:user_id(username, avatar_url)
          `)
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        
        setMessages(data || []);
        setLoading(false);
        scrollToBottom();
      } catch (error) {
        console.error('Error fetching chat messages:', error);
        setLoading(false);
      }
    };
    
    fetchMessages();
    
    // Subscribe to new messages
    const subscription = supabase
      .channel('chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `tournament_id=eq.${tournamentId}`
      }, async (payload) => {
        // Fetch the user data for the new message
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', payload.new.user_id)
          .single();
          
        const newMessage = {
          ...payload.new,
          user: data
        } as ChatMessage;
        
        setMessages(prev => [...prev, newMessage]);
        scrollToBottom();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [tournamentId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !currentUser) return;
    
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          tournament_id: tournamentId,
          user_id: currentUser.id,
          message: newMessage.trim()
        });
        
      if (error) throw error;
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-card h-[70vh] flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold">Чат турнира</h3>
        <p className="text-sm text-gray-400">Обсудите турнир с другими участниками</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-4">
            <span className="text-gray-400">Загрузка сообщений...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-4">
            <span className="text-gray-400">Пока нет сообщений. Напишите первым!</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.user_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.user_id === currentUser?.id 
                    ? 'bg-fc-accent/20 text-white' 
                    : 'bg-gray-700/50 text-white'
                }`}
              >
                <div className="flex items-center mb-1">
                  {msg.user_id !== currentUser?.id && (
                    <>
                      {msg.user?.avatar_url ? (
                        <img 
                          src={msg.user.avatar_url} 
                          alt={msg.user.username} 
                          className="w-5 h-5 rounded-full mr-1"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-600 mr-1"></div>
                      )}
                      <span className="text-xs font-medium mr-1">
                        {msg.user?.username || 'Неизвестный игрок'}
                      </span>
                    </>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p className="text-sm break-words">{msg.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={endOfMessagesRef} />
      </div>
      
      <form onSubmit={sendMessage} className="p-3 border-t border-gray-700 flex">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!currentUser}
          placeholder={currentUser ? "Написать сообщение..." : "Войдите, чтобы писать сообщения"}
          className="flex-1 bg-fc-background/50 border border-fc-muted rounded-l-lg py-2 px-4 text-white focus:outline-none focus:border-fc-accent"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || !currentUser}
          className="bg-fc-accent text-fc-background px-3 rounded-r-lg hover:bg-fc-accent-hover disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default TournamentChat;
