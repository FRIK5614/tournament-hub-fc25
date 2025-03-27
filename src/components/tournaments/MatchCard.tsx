
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { submitMatchResult, confirmMatchResult } from '@/services/tournamentService';
import { Check, X, Upload, Timer } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface MatchCardProps {
  match: any;
  userId: string | null;
}

const MatchCard = ({ match, userId }: MatchCardProps) => {
  const [player1Score, setPlayer1Score] = useState<string>(match.player1_score?.toString() || '');
  const [player2Score, setPlayer2Score] = useState<string>(match.player2_score?.toString() || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isPlayer1 = userId === match.player1_id;
  const isPlayer2 = userId === match.player2_id;
  const isAwaitingConfirmation = match.status === 'awaiting_confirmation';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmitResult = async () => {
    if (!player1Score || !player2Score || (!selectedFile && !match.result_image_url)) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите счет и прикрепите скриншот результата",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      let resultImageUrl = match.result_image_url;
      
      // Upload screenshot if provided
      if (selectedFile) {
        const fileName = `match-results/${match.id}/${Date.now()}-${selectedFile.name}`;
        const { data, error } = await supabase.storage
          .from('tournament-media')
          .upload(fileName, selectedFile);
          
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
          .from('tournament-media')
          .getPublicUrl(data.path);
          
        resultImageUrl = publicUrl;
      }
      
      await submitMatchResult(
        match.id, 
        parseInt(player1Score), 
        parseInt(player2Score), 
        resultImageUrl
      );
      
      toast({
        title: "Результат отправлен",
        description: isPlayer1 
          ? "Результат отправлен. Ожидание подтверждения от соперника." 
          : "Результат подтвержден.",
        variant: "default",
      });
      
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить результат",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmResult = async (confirm: boolean) => {
    try {
      setIsSubmitting(true);
      await confirmMatchResult(match.id, confirm);
      
      toast({
        title: confirm ? "Результат подтвержден" : "Результат отклонен",
        description: confirm
          ? "Матч завершен. Результаты сохранены."
          : "Матч возвращен в список ожидающих. Свяжитесь с соперником для повторной игры.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обработать запрос",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card border-fc-accent p-6">
      <h3 className="text-xl font-semibold mb-4">
        {isAwaitingConfirmation ? 'Подтверждение результата' : 'Текущий матч'}
      </h3>
      
      <div className="flex justify-between items-center bg-fc-background/50 p-4 rounded-lg mb-4">
        <div className="text-center flex-1">
          <div className="font-medium">{match.player1?.username || 'Игрок 1'}</div>
          {isAwaitingConfirmation && match.player1_score !== null && (
            <div className="text-2xl font-bold mt-1">{match.player1_score}</div>
          )}
          {isPlayer1 && <div className="text-xs mt-1 text-fc-accent">(Вы)</div>}
        </div>
        
        <div className="text-xl font-bold mx-4">vs</div>
        
        <div className="text-center flex-1">
          <div className="font-medium">{match.player2?.username || 'Игрок 2'}</div>
          {isAwaitingConfirmation && match.player2_score !== null && (
            <div className="text-2xl font-bold mt-1">{match.player2_score}</div>
          )}
          {isPlayer2 && <div className="text-xs mt-1 text-fc-accent">(Вы)</div>}
        </div>
      </div>
      
      {!isAwaitingConfirmation && (
        <div className="mb-6">
          <p className="text-gray-300 mb-4">
            Свяжитесь с соперником через чат, договоритесь о матче в игре, а затем отправьте результат.
            Не забудьте сделать скриншот результата для подтверждения.
          </p>
          
          <div className="flex justify-center items-center mb-4">
            <Timer className="text-yellow-500 mr-2" />
            <span className="text-sm">У вас есть 20 минут на проведение матча</span>
          </div>
        </div>
      )}
      
      {isAwaitingConfirmation && isPlayer2 ? (
        <>
          <div className="mb-6">
            <p className="text-gray-300 mb-4">
              Ваш соперник отправил результат матча. Пожалуйста, проверьте результат и подтвердите его,
              если он совпадает с вашими данными. Если результат неверный, отклоните его.
            </p>
            
            {match.result_image_url && (
              <div className="mb-4">
                <p className="text-sm mb-2">Скриншот результата:</p>
                <img 
                  src={match.result_image_url} 
                  alt="Match result" 
                  className="max-w-full rounded-lg border border-gray-600"
                />
              </div>
            )}
          </div>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => handleConfirmResult(true)}
              disabled={isSubmitting}
              className="btn-primary bg-green-600 hover:bg-green-700"
            >
              <Check className="mr-2" size={18} />
              Подтвердить
            </button>
            
            <button
              onClick={() => handleConfirmResult(false)}
              disabled={isSubmitting}
              className="btn-outline bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              <X className="mr-2" size={18} />
              Отклонить
            </button>
          </div>
        </>
      ) : isAwaitingConfirmation && isPlayer1 ? (
        <div className="text-center py-4">
          <p className="mb-4">Ожидание подтверждения результата от соперника.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="player1Score" className="block text-sm font-medium mb-1">
                  Счет игрока 1
                </label>
                <input
                  id="player1Score"
                  type="number"
                  min="0"
                  value={player1Score}
                  onChange={(e) => setPlayer1Score(e.target.value)}
                  className="w-full bg-fc-background/50 border border-fc-muted rounded-lg py-2 px-4 text-white focus:outline-none focus:border-fc-accent"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label htmlFor="player2Score" className="block text-sm font-medium mb-1">
                  Счет игрока 2
                </label>
                <input
                  id="player2Score"
                  type="number"
                  min="0"
                  value={player2Score}
                  onChange={(e) => setPlayer2Score(e.target.value)}
                  className="w-full bg-fc-background/50 border border-fc-muted rounded-lg py-2 px-4 text-white focus:outline-none focus:border-fc-accent"
                  placeholder="0"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="resultScreenshot" className="block text-sm font-medium mb-1">
                Скриншот результата
              </label>
              <label
                htmlFor="resultScreenshot"
                className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-fc-muted rounded-lg cursor-pointer hover:border-fc-accent bg-fc-background/30"
              >
                {selectedFile ? (
                  <span className="text-sm mt-2">{selectedFile.name}</span>
                ) : (
                  <>
                    <Upload className="mb-1" size={24} />
                    <span className="text-sm">Нажмите или перетащите файл</span>
                  </>
                )}
                <input
                  id="resultScreenshot"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
          
          <button
            onClick={handleSubmitResult}
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? 'Отправка...' : 'Отправить результат'}
          </button>
        </>
      )}
    </div>
  );
};

export default MatchCard;
