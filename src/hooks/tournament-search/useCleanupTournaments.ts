
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  cleanupDuplicateTournaments, 
  analyzeTournamentCreation 
} from '@/services/tournament';

// Хук для анализа и очистки дубликатов турниров
export const useCleanupTournaments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const { toast } = useToast();

  // Анализ причин создания множества турниров
  const analyzeCreationPatterns = async () => {
    setIsLoading(true);
    try {
      const result = await analyzeTournamentCreation();
      console.log('[TOURNAMENT-CLEANUP] Analysis result:', result);
      setAnalysis(result);
      return result;
    } catch (error: any) {
      console.error('[TOURNAMENT-CLEANUP] Analysis error:', error);
      toast({
        title: 'Ошибка анализа',
        description: error.message || 'Не удалось проанализировать турниры',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Очистка дубликатов турниров
  const cleanupDuplicates = async () => {
    setIsLoading(true);
    try {
      const result = await cleanupDuplicateTournaments();
      console.log('[TOURNAMENT-CLEANUP] Cleanup result:', result);
      setCleanupResult(result);
      
      toast({
        title: 'Очистка завершена',
        description: `Исправлено ${result.cleanedUp} дубликатов турниров`,
        variant: 'default',
      });
      
      return result;
    } catch (error: any) {
      console.error('[TOURNAMENT-CLEANUP] Cleanup error:', error);
      toast({
        title: 'Ошибка очистки',
        description: error.message || 'Не удалось очистить дубликаты турниров',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Автоматический анализ при монтировании компонента
  useEffect(() => {
    analyzeCreationPatterns();
    // Запускаем только при монтировании компонента
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isLoading,
    analysis,
    cleanupResult,
    analyzeCreationPatterns,
    cleanupDuplicates,
  };
};
