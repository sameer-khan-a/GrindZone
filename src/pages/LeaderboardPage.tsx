// src/pages/LeaderboardPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import LeaderboardTable from "@/components/tables/LeaderboardTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api";

type LeaderboardItem = {
  _id?: string;
  rank: number;
  teamName: string;
  teamLogo?: string;
  wins: number;
  losses: number;
  winPercentage: string;
  tier: string;
  region: string;
  game: string;
};

const InlinedLeaderboardFilters: React.FC<{
  onFilterChange: (filter: string, value: string) => void;
  selectedGame: string;
  selectedRegion: string;
  selectedTier: string;
}> = ({ onFilterChange, selectedGame, selectedRegion, selectedTier }) => {
  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-lg bg-grindzone-card">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Game</label>
        <select
          value={selectedGame}
          onChange={(e) => onFilterChange("game", e.target.value)}
          className="bg-grindzone-darker border border-grindzone-border text-white text-sm rounded-md p-2"
        >
          <option value="all">All Games</option>
          <option value="Free Fire">Free Fire</option>
          <option value="PUBG Mobile">PUBG Mobile</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Region</label>
        <select
          value={selectedRegion}
          onChange={(e) => onFilterChange("region", e.target.value)}
          className="bg-grindzone-darker border border-grindzone-border text-white text-sm rounded-md p-2"
        >
          <option value="all">All Regions</option>
          <option value="Global">Global</option>
          <option value="NA">NA</option>
          <option value="EU">EU</option>
          <option value="APAC">APAC</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Tier</label>
        <select
          value={selectedTier}
          onChange={(e) => onFilterChange("tier", e.target.value)}
          className="bg-grindzone-darker border border-grindzone-border text-white text-sm rounded-md p-2"
        >
          <option value="all">All Tiers</option>
          <option value="Professional">Professional</option>
          <option value="Semi-Pro">Semi-Pro</option>
          <option value="Amateur">Amateur</option>
        </select>
      </div>
    </div>
  );
};

const LeaderboardPage: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedTier, setSelectedTier] = useState("all");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("sort", "top");
    params.set("limit", "100");
    if (selectedGame && selectedGame !== "all") params.set("game", selectedGame);
    if (selectedRegion && selectedRegion !== "all") params.set("region", selectedRegion);
    if (selectedTier && selectedTier !== "all") params.set("tier", selectedTier);
    if (query.trim()) params.set("q", query.trim());
    return `${API_BASE}/squads?${params.toString()}`;
  }, [selectedGame, selectedRegion, selectedTier, query]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl();
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setError(`Server error: ${res.status} ${txt}`);
        return;
      }
      const json = await res.json();
      // map backend squad documents to LeaderboardItem
      const mapped: LeaderboardItem[] = (Array.isArray(json) ? json : []).map((it: any, idx: number) => ({
        _id: it._id,
        rank: it.rank ?? idx + 1,
        teamName: it.name ?? it.teamName ?? "Unknown",
        teamLogo: it.logo ?? it.teamLogo,
        wins: Number(it.wins ?? 0),
        losses: Number(it.losses ?? 0),
        winPercentage: it.winPercentage ?? (it.wins ? `${((it.wins / Math.max(1, it.wins + (it.losses ?? 0))) * 100).toFixed(1)}%` : "0.0%"),
        tier: it.tier ?? "Unknown",
        region: it.region ?? "Global",
        game: it.game ?? "Unknown",
      }));
      setData(mapped);
    } catch (err: any) {
      console.error("leaderboard fetch error", err);
      setError("Network error");
      toast({ title: "Network error", description: "Could not fetch leaderboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [buildUrl, toast]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

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

  const filteredData = useMemo(() => data, [data]);

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Leaderboard" subtitle="Top performing teams and players" />

        <InlinedLeaderboardFilters
          onFilterChange={handleFilterChange}
          selectedGame={selectedGame}
          selectedRegion={selectedRegion}
          selectedTier={selectedTier}
        />

        <div className="mb-4 flex items-center gap-2">
          <Input placeholder="Search team..." value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-md" />
          <Button onClick={() => fetchLeaderboard()} className="ml-2">Refresh</Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-400">Loading leaderboard…</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : filteredData.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No teams found matching your selected filters.</div>
        ) : (
          <LeaderboardTable data={filteredData} />
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
