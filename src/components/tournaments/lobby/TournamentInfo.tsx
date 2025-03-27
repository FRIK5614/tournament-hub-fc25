
interface TournamentInfoProps {
  tournament: any;
}

const TournamentInfo = ({ tournament }: TournamentInfoProps) => {
  if (!tournament) return null;
  
  return (
    <>
      <h2 className="text-2xl font-bold mb-4">{tournament?.title || 'Быстрый турнир'}</h2>
      
      {tournament?.status === 'active' && (
        <div className="bg-fc-accent/20 border border-fc-accent rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-2">Информация о турнире</h3>
          <p className="text-gray-300">
            Турнир активен. Каждый участник играет с каждым. 
            За победу начисляется 3 очка, за ничью - 1 очко.
            У вас есть 20 минут на проведение каждого матча.
          </p>
        </div>
      )}
    </>
  );
};

export default TournamentInfo;
