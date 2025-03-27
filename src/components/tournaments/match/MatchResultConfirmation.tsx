
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { confirmMatchResult } from '@/services/tournamentService';

interface MatchResultConfirmationProps {
  match: any;
}

const MatchResultConfirmation = ({ match }: MatchResultConfirmationProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
  );
};

export default MatchResultConfirmation;
