// src/pages/InvitePlayersPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api";
const buildFetchOpts = (method = "GET", body?: any, isJson = true) => {
  const opts: RequestInit = { method, credentials: "include", headers: {} };
  if (isJson) (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
  if (body) opts.body = JSON.stringify(body);
  return opts;
};

const isLikelyObjectId = (s?: string | null) => !!s && /^[0-9a-fA-F]{24}$/.test(s);

interface User { _id?: string; id?: string; username?: string; name?: string; status?: string; [k: string]: any; }

const InvitePlayersPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // read squadId from location.state OR query param
  const navState = (location.state ?? {}) as { squadId?: any; squadName?: string };
  const urlSearch = new URLSearchParams(location.search);
  const squadIdFromQuery = urlSearch.get("squadId");

  // normalize: support string, object with _id or id, or query param
  const rawSquad = navState.squadId ?? squadIdFromQuery ?? null;
  let normalizedSquadId: string | null = null;
  if (rawSquad) {
    if (typeof rawSquad === "string") normalizedSquadId = rawSquad;
    else if (typeof rawSquad === "object") {
      normalizedSquadId = rawSquad._id ?? rawSquad.id ?? null;
    }
    if (normalizedSquadId) normalizedSquadId = String(normalizedSquadId);
  }

  // final usable squadId only if it looks like a 24-hex ObjectId
  const squadId = isLikelyObjectId(normalizedSquadId) ? normalizedSquadId : null;
  const squadName = navState.squadName ?? null;

  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingMap, setSendingMap] = useState<Record<string, boolean>>({});
  const canInvite = Boolean(squadId);
const fetchUsers = useCallback(async () => {
  setLoading(true);
  try {
    if (rawSquad && !squadId) {
      console.warn("InvitePlayers: received invalid squadId, fetching global users instead:", rawSquad);
      toast({ title: "Warning", description: "Squad ID looks invalid — loading all players", duration: 3000 });
    }

    const url = squadId
      ? `${API_BASE}/users?excludeSquadId=${encodeURIComponent(squadId)}`
      : `${API_BASE}/users`;

    const res = await fetch(url, buildFetchOpts("GET"));
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("fetch users failed:", res.status, txt);
      setUsers([]);
      return;
    }

    const json = await res.json();

    // support debug wrapper { users, debug: { invitedIds: [...] } } OR plain array
    let returnedUsers: User[] = [];
    let invitedIds: string[] = [];

    if (Array.isArray(json)) {
      returnedUsers = json as User[];
    } else if (json && typeof json === "object") {
      if (Array.isArray(json.users)) returnedUsers = json.users as User[];
      // Some servers may return { users: [...], debug: {...} }
      if (json.debug && Array.isArray(json.debug.invitedIds)) invitedIds = json.debug.invitedIds;
    }

    // Defensive: normalize invitedIds to string set
    const invitedSet = new Set((invitedIds || []).map((id: any) => String(id)));

    // Filter client-side as a fail-safe so UI hides invites even if server didn't filter
    const filteredUsers = returnedUsers.filter(u => {
      const uid = String(u._id ?? u.id ?? "");
      return uid && !invitedSet.has(uid);
    });

    setUsers(filteredUsers);
  } catch (err: any) {
    console.error("fetch users error", err);
    toast({ title: "Error", description: "Failed to load players", variant: "destructive" });
    setUsers([]);
  } finally {
    setLoading(false);
  }
}, [API_BASE, squadId, rawSquad, toast]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return q ? users.filter(u => (u.username || u.name || "").toLowerCase().includes(q)) : users;
  }, [users, searchTerm]);

  const handleInvite = useCallback(async (user: User) => {
    if (!canInvite) {
      toast({ title: "No squad selected", description: "Select a squad first", variant: "destructive" });
      return;
    }
    const id = user._id ?? user.id;
    if (!id) return;

    setSendingMap(m => ({ ...m, [id]: true }));
    try {
      // Try primary invite endpoint (if available)
      const primaryBody = { identifier: user.username ?? id };
      const res = await fetch(`${API_BASE}/squads/${squadId}/invite`, buildFetchOpts("POST", primaryBody));
      if (res.ok) {
        toast({ title: "Invited", description: `${user.username ?? user.name ?? "Player"} invited.` });
        await fetchUsers();
        return;
      }

      // Fallback: create a squad-join request. Send both userId & targetId for safety
      const body = { userId: id, targetId: id, squadId };
      const alt = await fetch(`${API_BASE}/squad-requests`, buildFetchOpts("POST", body));
      if (alt.ok) {
        toast({ title: "Request sent", description: `${user.username ?? user.name ?? "Player"} will be notified.` });
        await fetchUsers();
        return;
      }

      let msg = "Invite failed";
      try { const j = await res.json().catch(() => ({})); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    } catch (err: any) {
      console.error("invite user error", err);
      toast({ title: "Error", description: err.message || "Invite failed", variant: "destructive" });
    } finally {
      setSendingMap(m => { const c = { ...m }; delete c[id]; return c; });
    }
  }, [API_BASE, canInvite, squadId, fetchUsers, toast]);

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Invite Players" subtitle={squadName ? `Invite players to ${squadName}` : "Search and invite players to your squad"} />
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {!canInvite && <div className="mb-4 p-3 rounded bg-yellow-900/20 text-yellow-200">No squad selected — invites are disabled.</div>}

        <div className="mb-6">
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search players by name" className="w-full max-w-md bg-grindzone-card text-white placeholder-gray-400" />
        </div>

        {loading ? <div className="text-zinc-400">Loading players...</div> : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(user => {
                const id = user._id ?? user.id ?? user.username ?? Math.random().toString(36).slice(2,9);
                return (
                  <Card key={id} className="bg-grindzone-card border border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{user.name ?? user.username ?? "Unknown"}</h4>
                        <p className={`text-sm mt-1 ${user.status === "Online" ? "text-green-500" : user.status === "In Game" ? "text-yellow-500" : "text-gray-400"}`}>{user.status ?? "Offline"}</p>
                      </div>
                      <div>
                        <Button onClick={() => handleInvite(user)} disabled={!canInvite || Boolean(sendingMap[id])} className="bg-grindzone-blue hover:bg-grindzone-blue-light">
                          {sendingMap[id] ? "Sending..." : "Invite"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filtered.length === 0 && <p className="text-center text-muted-foreground mt-8">No players found.</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePlayersPage;
