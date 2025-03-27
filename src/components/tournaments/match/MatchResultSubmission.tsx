
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { submitMatchResult } from '@/services/tournamentService';
import { supabase } from "@/integrations/supabase/client";

interface MatchResultSubmissionProps {
  match: any;
}

const MatchResultSubmission = ({ match }: MatchResultSubmissionProps) => {
  const [player1Score, setPlayer1Score] = useState<string>(match.player1_score?.toString() || '');
  const [player2Score, setPlayer2Score] = useState<string>(match.player2_score?.toString() || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
        description: "Результат отправлен. Ожидание подтверждения от соперника.",
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

  return (
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
  );
};

export default MatchResultSubmission;
