
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RankingFilters, { TimeFilter } from "@/components/rankings/RankingFilters";
import PlayerRankingTable from "@/components/rankings/PlayerRankingTable";
import { extendedPlayerData, PlayerData } from "@/data/playerRankingData";

const RankingsPage = () => {
  const [players, setPlayers] = useState(extendedPlayerData);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('alltime');
  const playersPerPage = 10;

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  // Handle search, filtering and sorting
  useEffect(() => {
    let filteredPlayers = [...extendedPlayerData];

    // Apply time filter (mock implementation)
    if (timeFilter !== 'alltime') {
      // This is just a simple mock - in a real app, you'd fetch different data based on timeFilter
      // Here we'll just modify the rankings slightly to simulate different time periods
      filteredPlayers = filteredPlayers.map(player => {
        const randomAdjustment = Math.floor(Math.random() * 30) - 15;
        return {
          ...player,
          rating: Math.max(1500, player.rating + (timeFilter === '24h' ? randomAdjustment * 2 : 
                                                 timeFilter === 'week' ? randomAdjustment : 
                                                 randomAdjustment / 2)),
          rank: player.rank, // We'll sort and reassign ranks after filtering
          wins: Math.max(1, player.wins + (timeFilter === '24h' ? Math.floor(randomAdjustment / 10) : 
                                          timeFilter === 'week' ? Math.floor(randomAdjustment / 5) : 
                                          Math.floor(randomAdjustment / 3))),
          change: timeFilter === '24h' ? Math.floor(Math.random() * 10) - 5 :
                 timeFilter === 'week' ? Math.floor(Math.random() * 15) - 7 :
                 Math.floor(Math.random() * 20) - 10
        };
      });
      
      // Re-sort by rating to simulate new rankings for the time period
      filteredPlayers.sort((a, b) => b.rating - a.rating);
      
      // Re-assign ranks
      filteredPlayers = filteredPlayers.map((player, index) => ({
        ...player,
        rank: index + 1
      }));
    }

    // Apply search filter
    if (searchQuery) {
      filteredPlayers = filteredPlayers.filter(player => 
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.country.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filteredPlayers = sortPlayers(filteredPlayers, sortColumn, sortDirection);

    setPlayers(filteredPlayers);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [searchQuery, sortColumn, sortDirection, timeFilter]);

  // Sort players based on the selected column and direction
  const sortPlayers = (playersToSort: PlayerData[], column: string, direction: "asc" | "desc") => {
    return [...playersToSort].sort((a, b) => {
      const aValue = a[column as keyof PlayerData];
      const bValue = b[column as keyof PlayerData];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
  };

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Calculate pagination
  const indexOfLastPlayer = currentPage * playersPerPage;
  const indexOfFirstPlayer = indexOfLastPlayer - playersPerPage;
  const currentPlayers = players.slice(indexOfFirstPlayer, indexOfLastPlayer);
  const totalPages = Math.ceil(players.length / playersPerPage);

  return (
    <div className="min-h-screen bg-fc-background text-white">
      <Navbar />
      
      {/* Page header */}
      <div className="pt-24 pb-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold">Рейтинг игроков</h1>
          <p className="text-gray-400 mt-2">Лучшие игроки турниров FC25</p>
        </div>
      </div>
      
      {/* Search, filters and time period selector */}
      <div className="px-6 md:px-12 pb-8">
        <div className="max-w-7xl mx-auto">
          <RankingFilters 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
          />
        </div>
      </div>
      
      {/* Players table */}
      <div className="px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          <PlayerRankingTable 
            players={currentPlayers}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            handleSort={handleSort}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
          />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default RankingsPage;
