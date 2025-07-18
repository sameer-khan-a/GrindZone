import React, { useState } from "react";
import Navbar from "@/components/navigation/Navbar"; // Assuming Navbar is correctly imported
import PageTitle from "@/components/ui/PageTitle";   // Assuming PageTitle is correctly imported
import LeaderboardTable from "@/components/tables/LeaderboardTable"; // Assuming LeaderboardTable is correctly imported and uses 'data' prop

// Define an interface for the leaderboard item to ensure type safety
interface LeaderboardItem {
  rank: number;
  teamName: string;
  teamLogo?: string; // Optional, as some mock data items don't have it
  wins: number;
  losses: number;
  winPercentage: string;
  tier: string;
  region: string;
  game: string;
}

// --- START: Inlined LeaderboardFilters Component (for demonstration) ---
// This would typically be in src/components/filters/LeaderboardFilters.tsx
interface LeaderboardFiltersProps {
  onFilterChange: (filter: string, value: string) => void;
  selectedGame: string;
  selectedRegion: string;
  selectedTier: string;
}

const InlinedLeaderboardFilters: React.FC<LeaderboardFiltersProps> = ({
  onFilterChange,
  selectedGame,
  selectedRegion,
  selectedTier,
}) => {
  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-lg bg-grindzone-card">
      {/* Game Filter */}
      <div>
        <label htmlFor="game-filter" className="block text-sm font-medium text-muted-foreground mb-1">Game</label>
        <select
          id="game-filter"
          value={selectedGame}
          onChange={(e) => onFilterChange("game", e.target.value)}
          className="bg-grindzone-darker border border-grindzone-border text-white text-sm rounded-md focus:ring-grindzone-blue focus:border-grindzone-blue block w-full p-2.5 cursor-pointer"
        >
          <option value="all">All Games</option>
          <option value="Free Fire">Free Fire</option>
          <option value="PUBG Mobile">PUBG Mobile</option>
          {/* Add other games if you expand your data */}
        </select>
      </div>

      {/* Region Filter */}
      <div>
        <label htmlFor="region-filter" className="block text-sm font-medium text-muted-foreground mb-1">Region</label>
        <select
          id="region-filter"
          value={selectedRegion}
          onChange={(e) => onFilterChange("region", e.target.value)}
          className="bg-grindzone-darker border border-grindzone-border text-white text-sm rounded-md focus:ring-grindzone-blue focus:border-grindzone-blue block w-full p-2.5 cursor-pointer"
        >
          <option value="all">All Regions</option>
          <option value="Global">Global</option>
          <option value="NA">NA</option>
          <option value="EU">EU</option>
          <option value="APAC">APAC</option>
          {/* Add other regions if you expand your data */}
        </select>
      </div>

      {/* Tier Filter */}
      <div>
        <label htmlFor="tier-filter" className="block text-sm font-medium text-muted-foreground mb-1">Tier</label>
        <select
          id="tier-filter"
          value={selectedTier}
          onChange={(e) => onFilterChange("tier", e.target.value)}
          className="bg-grindzone-darker border border-grindzone-border text-white text-sm rounded-md focus:ring-grindzone-blue focus:border-grindzone-blue block w-full p-2.5 cursor-pointer"
        >
          <option value="all">All Tiers</option>
          <option value="Professional">Professional</option>
          <option value="Semi-Pro">Semi-Pro</option>
          <option value="Amateur">Amateur</option>
          {/* Add other tiers if you expand your data */}
        </select>
      </div>
    </div>
  );
};
// --- END: Inlined LeaderboardFilters Component ---


const LeaderboardPage: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedTier, setSelectedTier] = useState("all");

  // Mock leaderboard data (now with type LeaderboardItem[])
  const leaderboardData: LeaderboardItem[] = [
    {
      rank: 1,
      teamName: "InvictusGaming",
      teamLogo: "/lovable-uploads/1870522f-377e-47ed-a81d-69c9f1a40855.png",
      wins: 58,
      losses: 12,
      winPercentage: "82.9%",
      tier: "Professional",
      region: "Global",
      game: "Free Fire"
    },
    {
      rank: 2,
      teamName: "TeamLiquid",
      teamLogo: "/lovable-uploads/c5971abd-922a-41aa-aae8-8790974a7631.png",
      wins: 52,
      losses: 18,
      winPercentage: "74.3%",
      tier: "Professional",
      region: "NA",
      game: "Free Fire"
    },
    {
      rank: 3,
      teamName: "FaZe Clan",
      wins: 49,
      losses: 21,
      winPercentage: "70.0%",
      tier: "Professional",
      region: "EU",
      game: "PUBG Mobile"
    },
    {
      rank: 4,
      teamName: "T1",
      wins: 47,
      losses: 23,
      winPercentage: "67.1%",
      tier: "Professional",
      region: "APAC",
      game: "Free Fire"
    },
    {
      rank: 5,
      teamName: "G2 Esports",
      wins: 42,
      losses: 28,
      winPercentage: "60.0%",
      tier: "Professional",
      region: "EU",
      game: "PUBG Mobile"
    },
    // Adding more mock data for better filtering demonstration
    {
      rank: 6,
      teamName: "Fnatic",
      wins: 38,
      losses: 15,
      winPercentage: "71.7%",
      tier: "Amateur", // Changed tier
      region: "EU",
      game: "Free Fire" // Changed game
    },
    {
      rank: 7,
      teamName: "Cloud9",
      wins: 35,
      losses: 20,
      winPercentage: "63.6%",
      tier: "Professional",
      region: "NA",
      game: "PUBG Mobile"
    },
    {
      rank: 8,
      teamName: "Evil Geniuses",
      wins: 30,
      losses: 25,
      winPercentage: "54.5%",
      tier: "Semi-Pro", // Changed tier
      region: "Global",
      game: "Free Fire"
    },
  ];

  const handleFilterChange = (filter: string, value: string) => {
    switch (filter) {
      case "game":
        setSelectedGame(value);
        break;
      case "region":
        setSelectedRegion(value);
        break;
      case "tier":
        setSelectedTier(value);
        break;
      default:
        break;
    }
  };

  const filteredData = leaderboardData.filter((item) => {
    const gameMatch = selectedGame === "all" || item.game === selectedGame;
    const regionMatch = selectedRegion === "all" || item.region === selectedRegion;
    const tierMatch = selectedTier === "all" || item.tier === selectedTier;

    return gameMatch && regionMatch && tierMatch;
  });

  return (
    <div className="min-h-screen bg-grindzone-dark text-white"> {/* Added text-white for general text visibility */}
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <PageTitle
          title="Leaderboard"
          subtitle="Top performing teams and players"
        />

        {/* Using the inlined filter component here */}
        <InlinedLeaderboardFilters
          onFilterChange={handleFilterChange}
          selectedGame={selectedGame}
          selectedRegion={selectedRegion}
          selectedTier={selectedTier}
        />

        {/* Display a message if no data matches the filters */}
        {filteredData.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No teams found matching your selected filters.
          </div>
        ) : (
          <LeaderboardTable data={filteredData} />
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;