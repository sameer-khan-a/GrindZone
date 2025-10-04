import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Trophy, Users, Coins, Plus, Edit, Trash, RefreshCw, Download } from "lucide-react";
import Navbar from "@/components/navigation/Navbar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

interface ParticipantsObj {
  current?: number;
  max?: number;
  currentPlayers?: number;
  maxPlayers?: number;
}

interface Tournament {
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

interface Payment {
  id: string;
  team: string;
  tournament: string;
  amount: string;
  date?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

// ------------------- Helpers -------------------
const normalizeParticipants = (p?: string | ParticipantsObj) => {
  if (!p) return { current: 0, max: 0, raw: undefined };
  if (typeof p === "string") {
    // handles "10/20", "10 of 20", "10 players", or single number
    const slash = p.match(/(\d+)\s*\/\s*(\d+)/);
    if (slash) return { current: Number(slash[1]), max: Number(slash[2]), raw: p };
    const of = p.match(/(\d+)\s*(?:of|out of)\s*(\d+)/i);
    if (of) return { current: Number(of[1]), max: Number(of[2]), raw: p };
    const single = p.match(/(\d+)/);
    if (single) return { current: Number(single[1]), max: Number(single[1]), raw: p };
    return { current: 0, max: 0, raw: p };
  }
  const current = Number(p.current ?? p.currentPlayers ?? 0);
  const max = Number(p.max ?? p.maxPlayers ?? 0);
  return { current: Number.isNaN(current) ? 0 : current, max: Number.isNaN(max) ? 0 : max, raw: undefined };
};

const parsePaymentAmount = (s?: string) => {
  if (!s) return 0;
  const m = s.match(/([-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-+]?\d+(?:\.\d+)?)/);
  if (!m) return 0;
  return Number(m[0].replace(/,/g, ""));
};

const tryFormatCurrency = (s?: string) => {
  if (!s) return s;
  const amount = parsePaymentAmount(s);
  if (amount === 0) return s;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return s;
  }
};

const dateTime = (iso?: string) => {
  if (!iso) return "TBA";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const downloadCSV = (filename: string, rows: string[]) => {
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Small UI bits
function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center justify-between bg-zinc-900/40 rounded p-4">
          <div className="h-4 w-64 bg-zinc-800 rounded" />
          <div className="h-4 w-24 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, title, description, onConfirm, onCancel }: { open: boolean; title?: string; description?: string; onConfirm: () => void; onCancel: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md p-6 bg-zinc-900 rounded-md border border-zinc-800">
        <h3 className="text-lg font-semibold">{title ?? "Confirm action"}</h3>
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-500" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  );
}

// ------------------- Main -------------------
const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminName, setAdminName] = useState("Admin");

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ activeTournaments: 0, registeredTeams: 0, totalPayments: 0 });

  const [recentTournaments, setRecentTournaments] = useState<Tournament[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "">("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "participants">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Confirm modal / abort
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteTargetRef = useRef<{ id: string; name?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const tournamentsPromise = fetch(`${API_BASE}/tournaments`, { method: "GET", headers: buildHeaders(), signal });
      const paymentsPromise = fetch(`${API_BASE}/payments`, { method: "GET", headers: buildHeaders(), signal });

      const [tRes, pRes] = await Promise.allSettled([tournamentsPromise, paymentsPromise]);

      if (tRes.status !== "fulfilled") throw tRes.reason;
      const tournamentsResponse = tRes.value as Response;

      if (!tournamentsResponse.ok) {
        if (tournamentsResponse.status === 401) {
          toast({ title: "Unauthorized", description: "Session expired. Please log in again.", variant: "destructive" });
          handleLogout();
          return;
        }
        throw new Error(`Failed to fetch tournaments (${tournamentsResponse.status})`);
      }

      const tournamentsRaw = await tournamentsResponse.json();

      let paymentsRaw: any[] = [];
      if (pRes.status === "fulfilled") {
        const pResponse = pRes.value as Response;
        if (pResponse.ok) paymentsRaw = await pResponse.json();
      }

      const tournaments: Tournament[] = (Array.isArray(tournamentsRaw) ? tournamentsRaw : []).map((t: any, idx: number) => ({
        ...t,
        id: t.id || t._id || `tmp-${idx}`,
        participants: t.participants,
        status: t.status ?? t.state ?? "Unknown",
      }));

      const payments: Payment[] = (Array.isArray(paymentsRaw) ? paymentsRaw : []).map((p: any, idx: number) => ({
        id: p.id || p._id || `pay-${idx}`,
        team: p.team || p.teamName || p.payer || "Unknown",
        tournament: p.tournament || p.tournamentId || p.tourney || "Unknown",
        amount: p.amount || p.value || "$0",
        date: p.date || p.createdAt,
      }));

      const ongoingCount = tournaments.filter(t => ["Ongoing", "Registration", "Upcoming"].includes(t.status ?? "")).length;
      const teamsCount = tournaments.reduce((acc, t) => acc + (normalizeParticipants(t.participants).current || 0), 0);
      const totalPayments = payments.reduce((acc, p) => acc + parsePaymentAmount(p.amount), 0);

      setRecentTournaments(tournaments);
      setRecentPayments(payments);
      setStats({ activeTournaments: ongoingCount, registeredTeams: teamsCount, totalPayments });
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      toast({ title: "Error", description: "Unable to fetch admin data. Check server or auth.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [buildHeaders, toast]);

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    const userName = localStorage.getItem("userName");
    if (userRole !== "admin") {
      toast({ title: "Access denied", description: "You need admin privileges to access this page", variant: "destructive" });
      navigate("/");
      return;
    }
    if (userName) setAdminName(userName);

    const controller = new AbortController();
    abortRef.current = controller;
    fetchData(controller.signal);

    const id = setInterval(() => fetchData(), 60_000);

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") fetchData();
      if (e.key.toLowerCase() === "n") navigate("/add-tournament");
    };
    window.addEventListener("keydown", keyHandler);

    return () => {
      controller.abort();
      clearInterval(id);
      window.removeEventListener("keydown", keyHandler);
    };
  }, [navigate, toast, fetchData]);

  const handleAddTournament = () => navigate("/add-tournament");
  const handleEditTournament = (mongoId?: string) => { if (!mongoId) { toast({ title: "Error", description: "Tournament id missing", variant: "destructive" }); return; } navigate(`/edit-tournament/${mongoId}`); };

  const onDeleteClick = (id: string, name?: string) => { deleteTargetRef.current = { id, name }; setConfirmOpen(true); };

  const confirmDelete = async () => {
    const target = deleteTargetRef.current; if (!target) return setConfirmOpen(false); setConfirmOpen(false);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${target.id}`, { method: "DELETE", headers: buildHeaders() });
      if (!res.ok) { const errText = await res.text().catch(() => res.statusText); throw new Error(`Delete failed: ${res.status} ${errText}`); }
      setRecentTournaments(prev => prev.filter(t => t.id !== target.id && t._id !== target.id));
      setStats(prev => ({ ...prev, activeTournaments: Math.max(0, prev.activeTournaments - 1) }));
      toast({ title: "Deleted", description: `${target.name ?? "Tournament"} removed.` });
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({ title: "Error deleting", description: err.message || "Failed to delete tournament", variant: "destructive" });
    }
  };

  const handleLogout = () => { localStorage.removeItem("userRole"); localStorage.removeItem("userName"); localStorage.removeItem("token"); toast({ title: "Logged out", description: "You have been logged out." }); navigate("/"); };

  // Filtering / Sorting / Pagination
  const filteredTournaments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let arr = recentTournaments.slice();
    if (q) arr = arr.filter(t => (t.name || "").toLowerCase().includes(q) || (t.game || "").toLowerCase().includes(q));
    if (statusFilter) arr = arr.filter(t => (t.status || "").toLowerCase() === statusFilter.toLowerCase());
    arr.sort((a, b) => {
      if (sortBy === "name") { const an = (a.name || "").toLowerCase(); const bn = (b.name || "").toLowerCase(); return sortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an); }
      if (sortBy === "participants") { const pa = normalizeParticipants(a.participants).current; const pb = normalizeParticipants(b.participants).current; return sortDir === "asc" ? pa - pb : pb - pa; }
      const da = a.date ? new Date(a.date).getTime() : 0; const db = b.date ? new Date(b.date).getTime() : 0; return sortDir === "asc" ? da - db : db - da;
    });
    return arr;
  }, [recentTournaments, searchQuery, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredTournaments.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);
  const pageData = useMemo(() => filteredTournaments.slice((page - 1) * pageSize, page * pageSize), [filteredTournaments, page]);

  // CSV Exports
  const exportTournamentsCSV = () => {
    const header = ["id,name,game,date,status,participants,prizePool"].join("");
    const rows = [header, ...recentTournaments.map(t => {
      const p = normalizeParticipants(t.participants);
      const participants = p.raw ? p.raw.replace(/,/g, "") : `${p.current}/${p.max}`;
      const prize = (t.prizePool ?? "").toString().replace(/,/g, "");
      return `${t.id.replace(/,/g, "")},"${(t.name||"").replace(/"/g, '""')}","${(t.game||"").replace(/"/g,'""')}","${t.date||""}","${t.status||""}","${participants}","${prize}"`;
    })];
    downloadCSV(`tournaments-${new Date().toISOString()}.csv`, rows);
  };

  const exportPaymentsCSV = () => {
    const header = ["id,team,tournament,amount,date"].join("");
    const rows = [header, ...recentPayments.map(p => `${p.id.replace(/,/g,"")},"${(p.team||"").replace(/"/g,'""')}","${(p.tournament||"").replace(/"/g,'""')}","${(p.amount||"")}","${p.date||""}"`)];
    downloadCSV(`payments-${new Date().toISOString()}.csv`, rows);
  };

  const formattedTotalPayments = useMemo(() => {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(stats.totalPayments); } catch { return `$${stats.totalPayments}`; }
  }, [stats.totalPayments]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <p className="text-purple-500">Welcome, {adminName}</p>
            <Button variant="outline" onClick={handleLogout} className="border-red-500 text-red-500 hover:bg-red-500/10" aria-label="Logout">Logout</Button>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search tournaments or game..." className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded w-full md:w-64" />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }} className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded">
              <option value="">All statuses</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Registration">Registration</option>
              <option value="Completed">Completed</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded">
              <option value="date">Sort: Date</option>
              <option value="name">Sort: Name</option>
              <option value="participants">Sort: Participants</option>
            </select>
            <select value={sortDir} onChange={e => setSortDir(e.target.value as any)} className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded">
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => { abortRef.current?.abort(); const c = new AbortController(); abortRef.current = c; fetchData(c.signal); }} className="bg-zinc-800 hover:bg-zinc-700" aria-label="Refresh">
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button onClick={handleAddTournament} className="bg-purple-600 hover:bg-purple-500"><Plus size={14} className="mr-2" />New</Button>
            <Button onClick={exportTournamentsCSV} className="bg-zinc-800 hover:bg-zinc-700" title="Export tournaments">
              <Download size={14} className="mr-2" />Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex items-center p-6">
              <div className="bg-purple-900/30 p-4 rounded-full mr-4"><Trophy size={24} className="text-purple-500" /></div>
              <div><p className="text-sm text-zinc-400">Active Tournaments</p><h3 className="text-2xl font-bold">{loading ? "..." : stats.activeTournaments}</h3></div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex items-center p-6">
              <div className="bg-purple-900/30 p-4 rounded-full mr-4"><Users size={24} className="text-purple-500" /></div>
              <div><p className="text-sm text-zinc-400">Registered Teams</p><h3 className="text-2xl font-bold">{loading ? "..." : stats.registeredTeams}</h3></div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex items-center p-6">
              <div className="bg-purple-900/30 p-4 rounded-full mr-4"><Coins size={24} className="text-purple-500" /></div>
              <div><p className="text-sm text-zinc-400">Total Payments</p><h3 className="text-2xl font-bold">{loading ? "..." : formattedTotalPayments}</h3></div>
            </CardContent>
          </Card>
        </div>

        {/* Tournaments Table */}
        <Card className="bg-zinc-900 border-zinc-800 mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Recent Tournaments</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={exportTournamentsCSV} className="bg-zinc-800 hover:bg-zinc-700" aria-label="Export tournaments"><Download size={14} className="mr-2"/>CSV</Button>
              <Button onClick={handleAddTournament} className="bg-purple-600 hover:bg-purple-500"><Plus size={16} className="mr-2"/> Add Tournament</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton rows={6} />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead>Tournament Name</TableHead>
                      <TableHead>Teams</TableHead>
                      <TableHead>Prize Pool</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageData.map((tournament) => (
                      <TableRow key={tournament.id} className="border-zinc-800">
                        <TableCell className="font-medium">{tournament.name}</TableCell>
                        <TableCell>
                          {(() => {
                            const p = normalizeParticipants(tournament.participants);
                            return p.raw ? p.raw : `${p.current}/${p.max}`;
                          })()}
                        </TableCell>
                        <TableCell>{tryFormatCurrency(tournament.prizePool) ?? "TBD"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            tournament.status === "Ongoing" ? "bg-green-500/20 text-green-400" :
                            tournament.status === "Upcoming" ? "bg-blue-500/20 text-blue-400" :
                            tournament.status === "Registration" ? "bg-purple-500/20 text-purple-400" :
                            "bg-zinc-500/20 text-zinc-400"
                          }`}>
                            {tournament.status ?? "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTournament(tournament._id || tournament.id)} aria-label={`Edit ${tournament.name}`}>
                              <Edit size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/20" onClick={() => onDeleteClick(tournament.id || tournament._id || "", tournament.name)} aria-label={`Delete ${tournament.name}`}>
                              <Trash size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {filteredTournaments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-zinc-500">No tournaments found. Click "Add Tournament" to create one.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredTournaments.length)} of {filteredTournaments.length}</div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                    <div className="px-3">{page} / {totalPages}</div>
                    <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-xl">Recent Payments</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={exportPaymentsCSV} className="bg-zinc-800 hover:bg-zinc-700"><Download size={14} className="mr-2"/>CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead>Team</TableHead>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id} className="border-zinc-800">
                      <TableCell className="font-medium">{payment.team}</TableCell>
                      <TableCell>{payment.tournament}</TableCell>
                      <TableCell>{tryFormatCurrency(payment.amount)}</TableCell>
                      <TableCell>{dateTime(payment.date)}</TableCell>
                    </TableRow>
                  ))}

                  {recentPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-zinc-500">No payment records found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <ConfirmModal open={confirmOpen} title={`Delete ${deleteTargetRef.current?.name ?? "tournament"}?`} description={`This will permanently delete the tournament${deleteTargetRef.current?.name ? `: ${deleteTargetRef.current.name}` : ""}.`} onConfirm={confirmDelete} onCancel={() => setConfirmOpen(false)} />
      </main>
    </div>
  );
};

export default AdminPage;
