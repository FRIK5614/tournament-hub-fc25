
import { Filter, Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export type TimeFilter = '24h' | 'week' | 'month' | 'alltime';

interface RankingFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  timeFilter: TimeFilter;
  setTimeFilter: (filter: TimeFilter) => void;
}

const RankingFilters = ({
  searchQuery,
  setSearchQuery,
  timeFilter,
  setTimeFilter
}: RankingFiltersProps) => {
  return (
    <div className="glass-card p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search bar */}
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Поиск игроков..."
              className="w-full bg-fc-background border border-fc-muted rounded-lg py-2 px-4 pl-10 text-white focus:outline-none focus:border-fc-accent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={18} className="text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          
          {/* Filters - simplified for now */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 flex items-center">
              <Filter size={16} className="mr-1" />
              Платформа:
            </span>
            <button className="px-3 py-1 rounded-full bg-fc-accent text-fc-background">
              Все
            </button>
            <button className="px-3 py-1 rounded-full bg-fc-muted text-white hover:bg-fc-muted/80">
              PS5
            </button>
            <button className="px-3 py-1 rounded-full bg-fc-muted text-white hover:bg-fc-muted/80">
              Xbox
            </button>
            <button className="px-3 py-1 rounded-full bg-fc-muted text-white hover:bg-fc-muted/80">
              PC
            </button>
          </div>
        </div>
        
        {/* Time period filter */}
        <div className="border-t border-fc-muted pt-4">
          <RadioGroup 
            value={timeFilter}
            onValueChange={(value) => setTimeFilter(value as TimeFilter)}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="24h" id="24h" className="border-fc-accent text-fc-accent" />
              <Label htmlFor="24h" className="text-sm cursor-pointer">За 24 часа</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="week" id="week" className="border-fc-accent text-fc-accent" />
              <Label htmlFor="week" className="text-sm cursor-pointer">За неделю</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="month" id="month" className="border-fc-accent text-fc-accent" />
              <Label htmlFor="month" className="text-sm cursor-pointer">За месяц</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="alltime" id="alltime" className="border-fc-accent text-fc-accent" />
              <Label htmlFor="alltime" className="text-sm cursor-pointer">За всё время</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
};

export default RankingFilters;
