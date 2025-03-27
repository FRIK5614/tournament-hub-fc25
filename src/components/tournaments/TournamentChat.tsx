
import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

const TournamentChat = ({ tournamentId }: { tournamentId: string }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        // Get profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', data.user.id)
          .single();
          
        setUser({
          ...data.user,
          username: profile?.username || data.user.email?.split('@')[0] || 'Гость',
          avatar_url: profile?.avatar_url
        });
      }
    };
    
    getUser();
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        // Make sure we're using the right structure for the query
        const { data, error } = await supabase
          .from('chat_messages')
          .select(`
            *,
            sender:user_id(id, username, avatar_url)
          `)
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: true });
          
        if (error) {
          throw error;
        }
        
        setMessages(data || []);
        setLoading(false);
        scrollToBottom();
      } catch (error: any) {
        console.error('Error loading chat messages:', error);
        toast({
          title: 'Ошибка загрузки чата',
          description: error.message || 'Не удалось загрузить сообщения',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };
    
    loadMessages();
    
    // Subscribe to new messages
    const channel = supabase
      .channel('tournament_chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `tournament_id=eq.${tournamentId}`
      }, async (payload) => {
        // Get the full message data with sender info
        const { data, error } = await supabase
          .from('chat_messages')
          .select(`
            *,
            sender:user_id(id, username, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();
          
        if (!error && data) {
          setMessages(prevMessages => [...prevMessages, data]);
          scrollToBottom();
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, toast]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user) return;
    
    try {
      // Make sure we're using the right structure for the insert
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          message: newMessage.trim(),
          user_id: user.id,
          tournament_id: tournamentId
        });
        
      if (error) {
        throw error;
      }
      
      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Ошибка отправки',
        description: error.message || 'Не удалось отправить сообщение',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="glass-card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-2 p-3 border-b border-gray-800">
        Чат турнира
      </h3>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[300px] max-h-[400px]">
        {loading ? (
          <div className="text-center py-4">
            <span className="animate-pulse">Загрузка сообщений...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Пока нет сообщений в чате
          </div>
        ) : (
          messages.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`flex gap-2 ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`rounded-lg px-3 py-2 max-w-[85%] break-words ${
                  msg.user_id === user?.id 
                    ? 'bg-fc-accent/20 text-white' 
                    : 'bg-gray-800 text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {msg.sender?.avatar_url && (
                    <img 
                      src={msg.sender.avatar_url} 
                      alt={msg.sender?.username || 'Участник'} 
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <span className="text-xs font-medium text-gray-300">
                    {msg.sender?.username || 'Участник'}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p>{msg.message}</p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messageEndRef} />
      </div>
      
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800 mt-auto">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Напишите сообщение..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fc-accent"
            disabled={!user}
          />
          <button
            type="submit"
            className="bg-fc-accent px-3 py-2 rounded hover:bg-fc-accent/80 disabled:opacity-50 disabled:hover:bg-fc-accent"
            disabled={!newMessage.trim() || !user}
          >
            <Send size={18} />
          </button>
        </div>
        {!user && (
          <p className="text-xs text-red-400 mt-1">
            Необходимо авторизоваться для отправки сообщений
          </p>
        )}
      </form>
    </div>
  );
};

export default TournamentChat;
