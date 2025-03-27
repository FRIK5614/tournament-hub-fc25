
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Tournaments from "./pages/Tournaments";
import LongTermTournaments from "./pages/LongTermTournaments";
import TournamentDetails from "./pages/TournamentDetails";
import Rankings from "./pages/Rankings";
import Streams from "./pages/Streams";
import Login from "./pages/Login";
import PlayerProfile from "./pages/PlayerProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/long-term-tournaments" element={<LongTermTournaments />} />
          <Route path="/tournaments/:id" element={<TournamentDetails />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/streams" element={<Streams />} />
          <Route path="/login" element={<Login />} />
          <Route path="/players/:id" element={<PlayerProfile />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
