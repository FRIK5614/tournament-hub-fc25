
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TournamentGrid from './TournamentGrid';
import CompletedTournamentGrid from './CompletedTournamentGrid';

interface TournamentTabsProps {
  activeTournaments: any[];
  completedTournaments: any[];
  loading: boolean;
}

const TournamentTabs = ({ activeTournaments, completedTournaments, loading }: TournamentTabsProps) => {
  return (
    <Tabs defaultValue="active">
      <TabsList className="mb-6">
        <TabsTrigger value="active">Активные турниры</TabsTrigger>
        <TabsTrigger value="completed">Завершенные турниры</TabsTrigger>
      </TabsList>
      
      <TabsContent value="active">
        <TournamentGrid 
          tournaments={activeTournaments} 
          loading={loading}
          emptyMessage="Сейчас нет активных турниров."
        />
      </TabsContent>
      
      <TabsContent value="completed">
        <CompletedTournamentGrid 
          tournaments={completedTournaments} 
          loading={loading}
          emptyMessage="Нет завершенных турниров."
        />
      </TabsContent>
    </Tabs>
  );
};

export default TournamentTabs;
