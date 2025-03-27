
interface ScheduleTabProps {
  matches: any[];
}

const ScheduleTab = ({ matches }: ScheduleTabProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-2">Ваши матчи</h3>
      
      {matches.length === 0 ? (
        <p className="text-gray-400 text-center py-4">У вас нет запланированных матчей.</p>
      ) : (
        matches.map((match) => (
          <div 
            key={match.id} 
            className={`glass-card p-4 ${
              match.status === 'completed' 
                ? 'opacity-60' 
                : 'border-fc-accent'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="font-medium">{match.player1?.username || 'Игрок 1'}</span>
                {match.status === 'completed' && (
                  <span className="mx-2 font-bold">{match.player1_score}</span>
                )}
              </div>
              
              <div className="mx-2 text-xs">
                {match.status === 'scheduled' && 'Запланирован'}
                {match.status === 'awaiting_confirmation' && 'Ожидает подтверждения'}
                {match.status === 'completed' && 'Завершен'}
              </div>
              
              <div className="flex items-center">
                {match.status === 'completed' && (
                  <span className="mx-2 font-bold">{match.player2_score}</span>
                )}
                <span className="font-medium">{match.player2?.username || 'Игрок 2'}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ScheduleTab;
