
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Star, ArrowDown, ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

// Player data type
export interface PlayerData {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  platform: 'ps5' | 'xbox' | 'pc';
  wins: number;
  change: number;
  rank: number;
  country: string;
  winRate: string;
  tournamentsPlayed: number;
}

interface PlayerRankingTableProps {
  players: PlayerData[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  handleSort: (column: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
}

const PlayerRankingTable = ({
  players,
  sortColumn,
  sortDirection,
  handleSort,
  currentPage,
  setCurrentPage,
  totalPages
}: PlayerRankingTableProps) => {
  // Platform styles
  const platformStyles = {
    ps5: "border-blue-500",
    xbox: "border-green-500",
    pc: "border-yellow-500"
  };

  return (
    <div className="glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead onClick={() => handleSort('rank')} className="cursor-pointer hover:text-fc-accent">
              <div className="flex items-center">
                #
                {sortColumn === 'rank' && (
                  sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                )}
              </div>
            </TableHead>
            <TableHead>Игрок</TableHead>
            <TableHead onClick={() => handleSort('rating')} className="cursor-pointer hover:text-fc-accent">
              <div className="flex items-center">
                Рейтинг
                {sortColumn === 'rating' && (
                  sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                )}
              </div>
            </TableHead>
            <TableHead onClick={() => handleSort('wins')} className="cursor-pointer hover:text-fc-accent">
              <div className="flex items-center">
                Победы
                {sortColumn === 'wins' && (
                  sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />
                )}
              </div>
            </TableHead>
            <TableHead className="hidden md:table-cell">Винрейт</TableHead>
            <TableHead className="hidden md:table-cell">Турниры</TableHead>
            <TableHead className="hidden md:table-cell">Страна</TableHead>
            <TableHead className="text-right">Изменение</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id} className="hover:bg-fc-muted/30">
              <TableCell className="font-medium">
                {player.rank <= 3 ? (
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    player.rank === 1 
                      ? 'bg-yellow-500' 
                      : player.rank === 2 
                        ? 'bg-gray-300' 
                        : 'bg-amber-700'
                  } text-fc-background font-bold`}>
                    {player.rank}
                  </div>
                ) : (
                  <div className="text-gray-400 font-bold pl-3">{player.rank}</div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <div className={`relative w-10 h-10 rounded-full border-2 ${platformStyles[player.platform]} overflow-hidden mr-3`}>
                    <img 
                      src={player.avatar} 
                      alt={player.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-medium">
                      <Link to={`/players/${player.id}`} className="hover:text-fc-accent transition-colors">
                        {player.name}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-400">{player.platform.toUpperCase()}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center text-fc-accent font-bold">
                  <Star size={14} className="mr-1" />
                  {player.rating}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <Trophy size={14} className="text-fc-accent mr-1" />
                  {player.wins}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{player.winRate}</TableCell>
              <TableCell className="hidden md:table-cell">{player.tournamentsPlayed}</TableCell>
              <TableCell className="hidden md:table-cell">{player.country}</TableCell>
              <TableCell className="text-right">
                {player.change !== 0 && (
                  <div className={`inline-flex items-center ${player.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {player.change > 0 ? (
                      <ArrowUp size={14} className="mr-0.5" />
                    ) : (
                      <ArrowDown size={14} className="mr-0.5" />
                    )}
                    <span>{Math.abs(player.change)}</span>
                  </div>
                )}
                {player.change === 0 && (
                  <span className="text-gray-500">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-fc-muted">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    isActive={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default PlayerRankingTable;
