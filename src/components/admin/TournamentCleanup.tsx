
import { useCleanupTournaments } from '@/hooks/tournament-search/useCleanupTournaments';
import { Button } from '@/components/ui/button';
import { Loader2, Trash, RefreshCw, AlertCircle } from 'lucide-react';

const TournamentCleanup = () => {
  const { isLoading, analysis, cleanupResult, analyzeCreationPatterns, cleanupDuplicates } = useCleanupTournaments();

  return (
    <div className="glass-card p-6">
      <h3 className="text-xl font-semibold mb-6 flex items-center">
        <AlertCircle className="text-yellow-500 mr-2" size={20} />
        Анализ и исправление дубликатов турниров
      </h3>
      
      <div className="space-y-4 mb-6">
        {analysis && (
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="font-medium text-gray-300 mb-2">Общая статистика:</p>
              <ul className="space-y-1 text-sm">
                <li>Проанализировано: {analysis.totalAnalyzed} турниров</li>
                <li>Обнаружено дубликатов: {analysis.totalDuplicates}</li>
                <li>Лобби с дубликатами: {Object.keys(analysis.duplicationPatterns).length}</li>
              </ul>
            </div>
            
            {Object.keys(analysis.duplicationPatterns).length > 0 && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <p className="font-medium text-gray-300 mb-2">Паттерны дублирования:</p>
                <div className="max-h-80 overflow-y-auto">
                  {Object.entries(analysis.duplicationPatterns).map(([lobbyId, pattern]: [string, any]) => (
                    <div key={lobbyId} className="mb-3 border-b border-gray-700 pb-3">
                      <p className="text-sm font-medium">Лобби: {lobbyId}</p>
                      <p className="text-xs text-gray-400">Количество: {pattern.count}</p>
                      <p className="text-xs text-gray-400">
                        Интервал создания: {pattern.avgInterval.toFixed(2)} сек
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {cleanupResult && (
          <div className="bg-green-500/20 text-green-400 p-4 rounded-lg">
            <p className="font-medium">Результат очистки:</p>
            <p>Исправлено {cleanupResult.cleanedUp} дубликатов турниров</p>
          </div>
        )}
      </div>
      
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={analyzeCreationPatterns}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Обновить анализ
        </Button>
        
        <Button
          variant="destructive"
          onClick={cleanupDuplicates}
          disabled={isLoading || (analysis && analysis.totalDuplicates === 0)}
          className="flex-1"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
          Очистить дубликаты
        </Button>
      </div>
    </div>
  );
};

export default TournamentCleanup;
