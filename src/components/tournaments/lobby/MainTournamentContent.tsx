
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TournamentInfo from './TournamentInfo';
import CurrentMatchTab from './CurrentMatchTab';
import TournamentStandings from '../TournamentStandings';
import ScheduleTab from './ScheduleTab';

interface MainTournamentContentProps {
  tournament: any;
  standings: any[];
  currentMatch: any | null;
  playerMatches: any[];
  userId: string | null;
  isLoading: boolean;
}

const MainTournamentContent = ({ 
  tournament, 
  standings, 
  currentMatch, 
  playerMatches, 
  userId,
  isLoading 
}: MainTournamentContentProps) => {
  return (
    <div className="glass-card p-6 mb-6">
      <TournamentInfo tournament={tournament} />
      
      <Tabs defaultValue="current-match">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="current-match" className="flex-1">Текущий матч</TabsTrigger>
          <TabsTrigger value="standings" className="flex-1">Таблица</TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1">Расписание</TabsTrigger>
        </TabsList>
        
        <TabsContent value="current-match">
          <CurrentMatchTab 
            currentMatch={currentMatch} 
            userId={userId}
            isLoading={isLoading}
          />
        </TabsContent>
        
        <TabsContent value="standings">
          <TournamentStandings standings={standings} />
        </TabsContent>
        
        <TabsContent value="schedule">
          <ScheduleTab matches={playerMatches} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MainTournamentContent;
