// src/pages/InvitePlayersPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const buildHeaders = (isJson = true) => {
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

interface User {
  _id?: string;
  id?: string;
  username?: string;
  name?: string;
  status?: string;
  [k: string]: any;
}

const InvitePlayersPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const navState = (location.state ?? {}) as { squadId?: string; squadName?: string };
  const squadId = navState.squadId ?? null;
  const squadName = navState.squadName ?? null;

  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingMap, setSendingMap] = useState<Record<string, boolean>>({});

  const canInvite = Boolean(squadId);

  useEffect(() => {
    const ac = new AbortController();
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/users`, { headers: buildHeaders(), signal: ac.signal });
        if (!res.ok) {
          // if no users route or it's empty, set empty array
          setUsers([]);
          setLoading(false);
          return;
        }
        const json = await res.json();
        setUsers(Array.isArray(json) ? json : []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("fetch users error", err);
          toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
        }
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
    return () => ac.abort();
  }, [toast]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return q ? users.filter(u => (u.username || u.name || "").toLowerCase().includes(q)) : users;
  }, [users, searchTerm]);

  const handleInvite = async (user: User) => {
    if (!canInvite) {
      toast({ title: "No squad selected", description: "Select a squad first", variant: "destructive" });
      return;
    }
    const id = user._id ?? user.id;
    if (!id) return;
    setSendingMap(m => ({ ...m, [id]: true }));
    try {
      // prefer dedicated invite endpoint
      const res = await fetch(`${API_BASE}/squads/${squadId}/invite`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ identifier: user.username || user._id || user.id }),
      });
      if (!res.ok) {
        // fallback: create a squad-join request
        try {
          const alt = await fetch(`${API_BASE}/squad-requests`, {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify({ userId: user._id || user.id, squadId }),
          });
          if (!alt.ok) throw new Error("Invite & request both failed");
        } catch (altErr) {
          let msg = "Invite failed";
          try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
          throw new Error(msg);
        }
      }

      setInvited(prev => [...prev, id]);
      toast({ title: "Invited", description: `${user.username || user.name} invited to ${squadName ?? "squad"}` });
    } catch (err: any) {
      console.error("invite user error", err);
      toast({ title: "Error", description: err.message || "Invite failed", variant: "destructive" });
    } finally {
      setSendingMap(m => { const c = { ...m }; delete c[id]; return c; });
    }
  };

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageTitle
            title="Invite Players"
            subtitle={squadName ? `Invite players to ${squadName}` : "Search and invite players to your squad"}
          />
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {!canInvite && (
          <div className="mb-4 p-3 rounded bg-yellow-900/20 text-yellow-200">No squad selected — invites are disabled.</div>
        )}

        <div className="mb-6">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search players by name"
            className="w-full max-w-md bg-grindzone-card text-white placeholder-gray-400"
          />
        </div>

        {loading ? (
          <div className="text-zinc-400">Loading players...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(user => {
                const id = user._id ?? user.id ?? user.username ?? Math.random().toString(36).slice(2,9);
                return (
                  <Card key={id} className="bg-grindzone-card border border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{user.name ?? user.username ?? "Unknown"}</h4>
                        <p className={`text-sm mt-1 ${
                          user.status === "Online" ? "text-green-500" : user.status === "In Game" ? "text-yellow-500" : "text-gray-400"
                        }`}>{user.status ?? "Offline"}</p>
                      </div>
                      <div>
                        <Button
                          onClick={() => handleInvite(user)}
                          disabled={!canInvite || invited.includes(id) || Boolean(sendingMap[id])}
                          className={`${invited.includes(id) ? "bg-gray-600 cursor-not-allowed" : "bg-grindzone-blue hover:bg-grindzone-blue-light"}`}
                        >
                          {invited.includes(id) ? "Invited" : (sendingMap[id] ? "Sending..." : "Invite")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground mt-8">No players found.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePlayersPage;
