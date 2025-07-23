import React, { useState, useEffect } from "react";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import TournamentCard from "@/components/cards/TournamentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

interface Tournament {
  id: string;
  name: string;
  game: string;
  date: string;
  tier: string;
  participants: string;
  image?: string;
  isFull?: boolean;
  status?: string;
  prizePool?: string;
  entryFee?: string;
  description?: string;
  rules?: string;
  _id?: string; // in case backend sends MongoDB _id
}

const TournamentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [ongoingTournaments, setOngoingTournaments] = useState<Tournament[]>([]);
  const [pastTournaments, setPastTournaments] = useState<Tournament[]>([]);

  const [selectedGame, setSelectedGame] = useState("All");
  const [selectedTier, setSelectedTier] = useState("All");
  const [showOnlyFull, setShowOnlyFull] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/tournaments");
      if (!response.ok) throw new Error("Failed to fetch tournaments");
      const allTournamentsRaw: Tournament[] = await response.json();

      // Normalize IDs: use id if exists, else _id, else fallback unique string
      const allTournaments = allTournamentsRaw.map((t, idx) => ({
        ...t,
        id: t.id || t._id || `temp-id-${idx}`,
      }));

      const upcoming: Tournament[] = [];
      const ongoing: Tournament[] = [];
      const past: Tournament[] = [];

      allTournaments.forEach(tournament => {
        const processedTournament = {
          ...tournament,
          status: tournament.status || determineStatus(tournament.date),
          isFull: isFullTournament(tournament.participants)
        };

        if (processedTournament.status === "Upcoming" || processedTournament.status === "Registration") {
          upcoming.push(processedTournament);
        } else if (processedTournament.status === "Ongoing") {
          ongoing.push(processedTournament);
        } else {
          past.push(processedTournament);
        }
      });

      setUpcomingTournaments(upcoming);
      setOngoingTournaments(ongoing);
      setPastTournaments(past);
    } catch (error) {
      console.error("Error loading tournaments:", error);
      toast({
        title: "Error loading tournaments",
        description: "There was a problem loading tournament data",
        variant: "destructive"
      });
    }
  };

  const isFullTournament = (participants: string): boolean => {
    const match = participants.match(/(\d+)\/(\d+)/);
    return match ? parseInt(match[1]) >= parseInt(match[2]) : false;
  };

  const determineStatus = (dateString: string): string => {
    const now = new Date();
    const tournamentDate = new Date(dateString);
    if (isNaN(tournamentDate.getTime())) return "Upcoming";

    const regStart = new Date(tournamentDate);
    regStart.setDate(tournamentDate.getDate() - 3);
    const end = new Date(tournamentDate);
    end.setDate(tournamentDate.getDate() + 1);

    if (now < regStart) return "Upcoming";
    if (now >= regStart && now < tournamentDate) return "Registration";
    if (now >= tournamentDate && now < end) return "Ongoing";
    return "Completed";
  };

  const filterTournaments = (tournaments: Tournament[]) =>
    tournaments
      .filter(t => selectedGame === "All" || t.game === selectedGame)
      .filter(t => selectedTier === "All" || t.tier === selectedTier)
      .filter(t => !showOnlyFull || t.isFull);

  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Tournaments" subtitle="Join competitions and prove your skills" />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
            className="bg-grindzone-card text-white px-4 py-2 rounded"
          >
            <option value="All">All Games</option>
            <option value="Free Fire">Free Fire</option>
            <option value="PUBG Mobile">PUBG Mobile</option>
            <option value="Valorant">Valorant</option>
          </select>

          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="bg-grindzone-card text-white px-4 py-2 rounded"
          >
            <option value="All">All Tiers</option>
            <option value="Amateur">Amateur</option>
            <option value="Semi-Pro">Semi-Pro</option>
            <option value="Professional">Professional</option>
          </select>

          <label className="flex items-center gap-2 text-white">
            <input
              type="checkbox"
              checked={showOnlyFull}
              onChange={() => setShowOnlyFull(!showOnlyFull)}
            />
            Only show full
          </label>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <TournamentGrid tournaments={filterTournaments(upcomingTournaments)} />
          </TabsContent>
          <TabsContent value="ongoing">
            <TournamentGrid tournaments={filterTournaments(ongoingTournaments)} />
          </TabsContent>
          <TabsContent value="past">
            <TournamentGrid tournaments={filterTournaments(pastTournaments)} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const TournamentGrid = ({ tournaments }: { tournaments: Tournament[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {tournaments.map(t => (
      <TournamentCard key={t.id} {...t} />
    ))}
    {tournaments.length === 0 && (
      <div className="col-span-full text-center py-12 text-muted-foreground">
        No tournaments found.
      </div>
    )}
  </div>
);

export default TournamentsPage;
