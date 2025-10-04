// src/pages/TournamentDetailsPage.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarIcon, TrophyIcon, UsersIcon, CreditCardIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Tournament {
  _id?: string;
  id?: string;
  name: string;
  game: string;
  date?: string;
  tier?: string;
  participants?: string | { current?: number; max?: number };
  image?: string;
  prizePool?: string;
  entryFee?: string;
  status?: string;
  description?: string;
  rules?: string | string[];
  isFull?: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const normalizeParticipants = (p?: string | { current?: number; max?: number }) => {
  if (!p) return { current: 0, max: 0, raw: undefined };
  if (typeof p === "string") {
    const m = p.match(/^\s*(\d+)\s*\/\s*(\d+)/);
    if (m) return { current: Number(m[1]), max: Number(m[2]), raw: p };
    return { current: 0, max: 0, raw: p };
  }
  const current = Number(p.current ?? p["currentPlayers"] ?? 0);
  const max = Number(p.max ?? p["maxPlayers"] ?? 0);
  return { current: Number.isNaN(current) ? 0 : current, max: Number.isNaN(max) ? 0 : max, raw: undefined };
};

const buildHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const TournamentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [debug, setDebug] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setDebug("No ID provided in route params");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchById = async (lookupId: string) => {
      const url = `${API_BASE}/tournaments/${lookupId}`;
      console.debug("[TournamentDetails] fetchById ->", url);
      try {
        const res = await fetch(url, { headers: buildHeaders() });
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return { ok: res.ok, status: res.status, body: json };
        } catch {
          return { ok: res.ok, status: res.status, body: text };
        }
      } catch (err) {
        return { ok: false, status: 0, body: String(err) };
      }
    };

    const fetchAllAndFind = async (lookupId: string) => {
      const url = `${API_BASE}/tournaments`;
      console.debug("[TournamentDetails] fetchAllAndFind ->", url);
      try {
        const res = await fetch(url, { headers: buildHeaders() });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { ok: false, status: res.status, body: text };
        }
        const arr = await res.json();
        if (!Array.isArray(arr)) return { ok: false, status: 200, body: "Not an array" };
        const found = arr.find((t: any) => String(t._id) === String(lookupId) || String(t.id) === String(lookupId));
        return { ok: !!found, status: found ? 200 : 404, body: found ?? null };
      } catch (err) {
        return { ok: false, status: 0, body: String(err) };
      }
    };

    (async () => {
      setIsLoading(true);
      setDebug(null);

      // Try direct fetch by id (preferred)
      const attempt = await fetchById(id!);
      console.debug("[TournamentDetails] attempt:", attempt);
      if (!cancelled && attempt.ok) {
        setTournament(attempt.body);
        setIsLoading(false);
        return;
      }

      // Fallback: fetch list and match
      const fallback = await fetchAllAndFind(id!);
      console.debug("[TournamentDetails] fallback:", fallback);
      if (!cancelled && fallback.ok && fallback.body) {
        setTournament(fallback.body);
        setIsLoading(false);
        setDebug(`Found via fallback list. originalAttemptStatus=${attempt.status}`);
        return;
      }

      // Nothing found
      if (!cancelled) {
        setTournament(null);
        setIsLoading(false);
        setDebug(`Lookup failed. byIdStatus=${attempt.status}; listStatus=${fallback.status}. See console for details.`);
        console.warn("[TournamentDetails] fetch attempt failed", { attempt, fallback });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const isTournamentFull = (t?: Tournament) => {
    const parsed = normalizeParticipants(t?.participants);
    return parsed.max > 0 && parsed.current >= parsed.max;
  };

  // Join flow: increments participants count server-side via PUT
  const handlePayment = async () => {
    if (!tournament || !tournament._id && !tournament.id) {
      toast({ title: "Error", description: "Tournament id missing", variant: "destructive" });
      return;
    }

    const mongoId = tournament._id || tournament.id!;
    setJoining(true);

    // compute new participants value
    const parsed = normalizeParticipants(tournament.participants);
    const current = parsed.current;
    const max = parsed.max;
    const newCurrent = max && current < max ? current + 1 : current;
    const participantsString = parsed.raw ?? `${newCurrent}/${max || current}`; // if no max, keep string shape

    // Prepare payload: we'll update participants and isFull
    const payload: any = {
      participants: `${newCurrent}/${max || current}`,
    };
    if (max) payload.isFull = newCurrent >= max;

    // Optimistically update UI
    const prevTournament = tournament;
    setTournament({ ...tournament, participants: payload.participants, isFull: payload.isFull });

    try {
      // Try to update tournament via PUT
      const res = await fetch(`${API_BASE}/tournaments/${mongoId}`, {
        method: "PUT",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Tournament update failed: ${res.status} ${text}`);
      }

      // Optionally create a payment record (best-effort)
      try {
        const paymentPayload = {
          team: localStorage.getItem("userName") || "Your Team",
          tournament: tournament.name,
          amount: tournament.entryFee || "Free",
          date: new Date().toISOString(),
        };
        const pRes = await fetch(`${API_BASE}/payments`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(paymentPayload),
        });
        if (!pRes.ok) {
          console.debug("payments POST failed, continuing without it");
        }
      } catch (e) {
        console.debug("payments POST threw:", e);
      }

      toast({ title: "Joined", description: `You joined ${tournament.name}` });
    } catch (err: any) {
      // rollback UI
      setTournament(prevTournament);
      console.error("Join error:", err);
      toast({ title: "Failed", description: err.message || "Could not join tournament", variant: "destructive" });
    } finally {
      setJoining(false);
      setIsPaymentDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-grindzone-dark">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <p className="text-muted-foreground">Loading tournament details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-grindzone-dark">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <PageTitle title="Tournament Not Found" subtitle="The tournament you're looking for does not exist" />
          {debug && <pre className="mt-2 p-3 bg-zinc-800 text-xs text-red-300 rounded">{debug}</pre>}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => navigate("/tournaments")}>Back to tournaments</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  const parsed = normalizeParticipants(tournament.participants);
  const participantsDisplay = parsed.raw ?? `${parsed.current}/${parsed.max}`;

  return (
    <div className="min-h-screen bg-grindzone-dark">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between mb-6">
          <Button variant="outline" onClick={() => navigate("/tournaments")} className="mb-4 md:mb-0">
            ← Back to Tournaments
          </Button>
          <PageTitle title={tournament.name} subtitle={`${tournament.game} Tournament`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-grindzone-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      {tournament.image ? (
                        <img src={tournament.image} alt={tournament.game} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="text-2xl font-bold text-white">{(tournament.game || "NA").substring(0, 2)}</div>
                      )}
                    </div>
                    <div>
                      <CardTitle>{tournament.name}</CardTitle>
                      <CardDescription>{tournament.game}</CardDescription>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs bg-grindzone-darker px-3 py-1 rounded-full border border-border">
                      {tournament.tier || "Standard"}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="mb-4 text-muted-foreground">
                  {tournament.description || `Join this exciting ${tournament.game} tournament and compete.`}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-purple-500" />
                    <span>{tournament.date ? new Date(tournament.date).toLocaleString() : "TBA"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UsersIcon size={16} className="text-purple-500" />
                    <span>{participantsDisplay}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrophyIcon size={16} className="text-purple-500" />
                    <span>Prize Pool: {tournament.prizePool || "TBD"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCardIcon size={16} className="text-purple-500" />
                    <span>Entry Fee: {tournament.entryFee || "Free"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-grindzone-card border-border">
              <CardHeader>
                <CardTitle>Tournament Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-2">
                  {Array.isArray(tournament.rules) ? (
                    (tournament.rules as string[]).map((rule, idx) => <li key={idx} className="text-muted-foreground">{rule}</li>)
                  ) : (
                    <li className="text-muted-foreground">{tournament.rules ?? "Standard tournament rules apply"}</li>
                  )}
                </ul>
              </CardContent>
              <CardFooter>
                {isTournamentFull(tournament) ? (
                  <Button disabled className="w-full bg-gray-600 hover:bg-gray-600 cursor-not-allowed">Tournament Full</Button>
                ) : (
                  <Button className="w-full bg-grindzone-blue hover:bg-grindzone-blue-light" onClick={() => setIsPaymentDialogOpen(true)}>
                    Join Tournament
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="bg-grindzone-card">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>Pay the registration fee to join {tournament?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-grindzone-darker rounded-md">
              <p className="font-semibold">Tournament: {tournament?.name}</p>
              <p className="text-muted-foreground">Registration Fee: {tournament?.entryFee || "Free"}</p>
            </div>

            {/* Minimal payment form (placeholder) */}
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Card number" className="p-2 bg-grindzone-darker border border-border rounded" />
              <input type="text" placeholder="MM/YY" className="p-2 bg-grindzone-darker border border-border rounded" />
              <input type="text" placeholder="CVC" className="p-2 bg-grindzone-darker border border-border rounded" />
              <input type="text" placeholder="Name on card" className="p-2 bg-grindzone-darker border border-border rounded" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment} className="bg-grindzone-blue hover:bg-grindzone-blue-light" disabled={joining}>
              {joining ? "Joining..." : `Pay ${tournament?.entryFee || "Free"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TournamentDetailsPage;
