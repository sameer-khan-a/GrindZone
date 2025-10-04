// src/pages/TournamentsPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import TournamentCard from "@/components/cards/TournamentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { DownloadIcon, XIcon } from "lucide-react";

/* ---------------------------
   Types
   --------------------------- */
interface ParticipantsObj {
  current?: number;
  max?: number;
  currentPlayers?: number;
  maxPlayers?: number;
}

export interface Tournament {
  id: string;
  name: string;
  game?: string;
  date?: string;
  tier?: string;
  participants?: string | ParticipantsObj;
  image?: string;
  isFull?: boolean;
  status?: string;
  prizePool?: string;
  entryFee?: string;
  description?: string;
  rules?: string;
  _id?: string;
}

/* ---------------------------
   Helpers
   --------------------------- */
const parsePrizeNumber = (prize?: string) => {
  if (!prize) return 0;
  // "$12,000" -> 12000
  const n = Number(prize.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const normalizeParticipants = (p?: string | ParticipantsObj) => {
  if (!p) return { current: 0, max: 0, raw: undefined };
  if (typeof p === "string") {
    const m = p.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (m) return { current: Number(m[1]), max: Number(m[2]), raw: p };
    // fallback: malformed string
    return { current: 0, max: 0, raw: p };
  }
  const current = Number(p.current ?? p.currentPlayers ?? 0);
  const max = Number(p.max ?? p.maxPlayers ?? 0);
  return { current: Number.isNaN(current) ? 0 : current, max: Number.isNaN(max) ? 0 : max, raw: undefined };
};

const isFullFromParticipants = (p?: string | ParticipantsObj, explicit?: boolean) => {
  if (explicit) return true;
  const parsed = normalizeParticipants(p);
  if (!parsed.max) return false;
  return parsed.current >= parsed.max;
};

const formatDate = (date?: string) => (date ? new Date(date).toLocaleString() : "TBA");

/* ---------------------------
   Component
   --------------------------- */
const PAGE_SIZES = [8, 12, 20];

const TournamentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"upcoming" | "ongoing" | "past">("upcoming");

  const [loading, setLoading] = useState(false);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState<string | null>(null);

  // UI filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState("All");
  const [selectedTier, setSelectedTier] = useState("All");
  const [showOnlyFull, setShowOnlyFull] = useState(false);
  const [sortBy, setSortBy] = useState<"date-asc" | "date-desc" | "prize-desc" | "availability">(
    "date-asc"
  );

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const { toast } = useToast();

  /* ---------------------------
     Fetch + Normalize
     --------------------------- */
  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:5000/api/tournaments");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: any = await res.json();
      if (!Array.isArray(raw)) throw new Error("Invalid payload");
      const normalized: Tournament[] = raw.map((t: any, idx: number) => {
        const id = t.id || t._id || `tmp-${idx}`;
        // normalize participants to either string (unchanged) or object {current,max}
        let participants = t.participants;
        if (typeof participants === "object" && participants !== null) {
          // keep as object
          participants = {
            current: Number(participants.current ?? participants.currentPlayers ?? 0),
            max: Number(participants.max ?? participants.maxPlayers ?? 0),
          };
        }
        // ensure status and date shape
        const date = t.date ?? t.datetime ?? t.scheduledAt;
        const status = t.status; // leave undefined to compute on client
        return {
          ...t,
          id,
          participants,
          date,
          status,
        } as Tournament;
      });

      // compute client-side meta (isFull + status tuning)
      const computed = normalized.map((t) => {
        const computedStatus = t.status || determineStatus(t.date);
        const isFull = isFullFromParticipants(t.participants, !!t.isFull);
        return { ...t, status: computedStatus, isFull };
      });

      setAllTournaments(computed);
    } catch (err: any) {
      console.error("fetch error", err);
      setError(err.message || "Failed to load tournaments");
      toast({
        title: "Error",
        description: "Couldn't load tournaments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTournaments();

    // auto-refresh every 60 seconds to keep statuses accurate
    const id = setInterval(fetchTournaments, 60_000);
    return () => clearInterval(id);
  }, [fetchTournaments]);

  /* ---------------------------
     Debounce search
     --------------------------- */
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [search]);

  /* ---------------------------
     Derived UI options (games, tiers)
     --------------------------- */
  const gameOptions = useMemo(() => {
    const s = new Set<string>();
    allTournaments.forEach((t) => t.game && s.add(t.game));
    return ["All", ...Array.from(s).sort()];
  }, [allTournaments]);

  const tierOptions = useMemo(() => {
    const s = new Set<string>();
    allTournaments.forEach((t) => t.tier && s.add(t.tier));
    return ["All", ...Array.from(s).sort()];
  }, [allTournaments]);

  /* ---------------------------
     Tab-splitting + filter + sort + paginate
     --------------------------- */
  const grouped = useMemo(() => {
    const upcoming: Tournament[] = [];
    const ongoing: Tournament[] = [];
    const past: Tournament[] = [];
    allTournaments.forEach((t) => {
      if (t.status === "Ongoing") ongoing.push(t);
      else if (t.status === "Registration" || t.status === "Upcoming") upcoming.push(t);
      else past.push(t);
    });
    return { upcoming, ongoing, past };
  }, [allTournaments]);

  const activeSource = useMemo(() => {
    return activeTab === "upcoming" ? grouped.upcoming : activeTab === "ongoing" ? grouped.ongoing : grouped.past;
  }, [grouped, activeTab]);

  const filteredSorted = useMemo(() => {
    let arr = [...activeSource];

    // search (name, game, prize, tier) — coerce everything to string first
    if (debouncedSearch) {
      const q = debouncedSearch;
      arr = arr.filter((t) =>
        [t.name, t.game, t.tier, t.prizePool, t.description, t.rules]
          .some((s) => String(s ?? "").toLowerCase().includes(q))
      );
    }

    // game/tier filters
    if (selectedGame !== "All") arr = arr.filter((t) => t.game === selectedGame);
    if (selectedTier !== "All") arr = arr.filter((t) => t.tier === selectedTier);

    // fullness filter
    if (showOnlyFull) arr = arr.filter((t) => Boolean(t.isFull));

    // sort
    if (sortBy === "date-asc") {
      arr.sort((a, b) => (new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()));
    } else if (sortBy === "date-desc") {
      arr.sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
    } else if (sortBy === "prize-desc") {
      arr.sort((a, b) => parsePrizeNumber(b.prizePool) - parsePrizeNumber(a.prizePool));
    } else if (sortBy === "availability") {
      // non-full first
      arr.sort((a, b) => Number(a.isFull) - Number(b.isFull));
    }

    return arr;
  }, [activeSource, debouncedSearch, selectedGame, selectedTier, showOnlyFull, sortBy]);

  // pagination
  const total = filteredSorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize]);

  /* ---------------------------
     Utility: CSV export
     --------------------------- */
  const exportCSV = () => {
    const rows = filteredSorted.map((t) => {
      const p = normalizeParticipants(t.participants);
      return {
        id: t.id,
        name: t.name,
        game: t.game,
        date: t.date,
        tier: t.tier,
        participants: `${p.current}/${p.max}`,
        status: t.status,
        prizePool: t.prizePool ?? "",
        entryFee: t.entryFee ?? "",
      };
    });
    const csv = [
      Object.keys(rows[0] || {}).join(","),
      ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tournaments_${activeTab}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---------------------------
     Render
     --------------------------- */
  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Tournaments" subtitle="Join competitions and prove your skills" />

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-6">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <input
              aria-label="Search tournaments"
              placeholder="Search name, game, tier, prize..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-grindzone-card text-white px-4 py-2 rounded w-full lg:w-96"
            />

            {search ? (
              <Button onClick={() => { setSearch(""); setDebouncedSearch(""); }}>
                <XIcon size={14} className="mr-2" /> Clear
              </Button>
            ) : null}
          </div>

          <div className="flex gap-2 flex-wrap ml-auto">
            <select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)} className="bg-grindzone-card text-white px-3 py-2 rounded">
              {gameOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>

            <select value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)} className="bg-grindzone-card text-white px-3 py-2 rounded">
              {tierOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-grindzone-card text-white px-3 py-2 rounded">
              <option value="date-asc">Date ↑</option>
              <option value="date-desc">Date ↓</option>
              <option value="prize-desc">Prize (High → Low)</option>
              <option value="availability">Availability</option>
            </select>

            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="bg-grindzone-card text-white px-3 py-2 rounded">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>

            <label className="flex items-center gap-2 text-white">
              <input type="checkbox" checked={showOnlyFull} onChange={() => setShowOnlyFull(v => !v)} />
              Only full
            </label>

            <Button onClick={exportCSV}>
              <DownloadIcon size={14} className="mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" value={activeTab} onValueChange={(v: any) => { setActiveTab(v); setPage(1); }}>
          <TabsList className="mb-4">
            <TabsTrigger value="upcoming">Upcoming ({grouped.upcoming.length})</TabsTrigger>
            <TabsTrigger value="ongoing">Ongoing ({grouped.ongoing.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({grouped.past.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <RenderGrid
              loading={loading}
              error={error}
              tournaments={paged}
              total={total}
              page={page}
              pageCount={pageCount}
              setPage={setPage}
              activeTab={activeTab}
            />
          </TabsContent>

          <TabsContent value="ongoing">
            <RenderGrid
              loading={loading}
              error={error}
              tournaments={paged}
              total={total}
              page={page}
              pageCount={pageCount}
              setPage={setPage}
              activeTab={activeTab}
            />
          </TabsContent>

          <TabsContent value="past">
            <RenderGrid
              loading={loading}
              error={error}
              tournaments={paged}
              total={total}
              page={page}
              pageCount={pageCount}
              setPage={setPage}
              activeTab={activeTab}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

/* ---------------------------
   Small subcomponents
   --------------------------- */
const RenderGrid: React.FC<{
  loading: boolean;
  error: string | null;
  tournaments: Tournament[];
  total: number;
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  activeTab: string;
}> = ({ loading, error, tournaments, total, page, pageCount, setPage, activeTab }) => {
  if (loading) {
    // simple skeleton
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-grindzone-card rounded-xl h-64" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 p-6">Error loading tournaments: {error}</div>;
  }

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-24 col-span-full">
        <h3 className="text-xl font-semibold">No {activeTab} tournaments found</h3>
        <p className="text-muted-foreground mt-2">Try clearing filters or changing sort/page size.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
        {tournaments.map((t) => (
          <TournamentCard key={t.id} {...t} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Showing page {page} of {pageCount} — {total} results</div>

        <div className="flex gap-2">
          <Button disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <Button disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</Button>
          <Button disabled={page >= pageCount} onClick={() => setPage(pageCount)}>Last</Button>
        </div>
      </div>
    </>
  );
};

/* ---------------------------
   Status helper (copied/kept from your logic)
   --------------------------- */
const determineStatus = (dateString?: string): string => {
  if (!dateString) return "Upcoming";
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

export default TournamentsPage;
